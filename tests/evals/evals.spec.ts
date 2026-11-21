import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@gleanwork/mcp-server-tester/fixtures/mcp';
import { runEvalDataset } from '@gleanwork/mcp-server-tester';
import { readState } from '../integration/fixtures.js';
import { buildEvalDataset } from './dataset.js';
import { EVAL_LAYOUT } from './layout.js';
import {
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  MAX_UPSTREAM_ATTEMPTS,
} from './go-proxy.js';

const DEFAULT_ITERATIONS = Number(process.env.MCP_EVAL_ITERATIONS ?? 10);
// Assumed time for one model turn with tool calls. Unverified against a live run.
const MS_PER_ITERATION = 60_000;
// Room for one stalled upstream call, which the AI SDK retries up to
// MAX_UPSTREAM_ATTEMPTS times. A second stall in the same case exceeds this
// budget. Playwright then fails the test without a result file.
const STALL_BUDGET_MS = MAX_UPSTREAM_ATTEMPTS * DEFAULT_UPSTREAM_TIMEOUT_MS;
// Largest pass-rate drop that is not a regression. One trial out of ten is 0.1.
const RATE_TOLERANCE = 0.1;
// MST reports no infrastructureErrorRate for single-iteration cases, and its
// classifier does not see proxy 503s after the AI SDK retries. These markers
// classify error text. Each marker names a status or error class, not a
// generic word, so a model or tool error is not counted as an outage.
const OUTAGE_PATTERN =
  /503|upstream timed out|go proxy upstream error|429|rate limit|econnreset|etimedout|econnrefused|enotfound|fetch failed|other side closed|socketerror/i;

// Case ids do not depend on fixture state, so a placeholder lists them
// without reading state.json, which exists only after global setup runs.
const placeholder = { alphaSessionId: 'list', betaSessionId: 'list' };
const resultsDir = path.resolve(import.meta.dirname, '../../.mcp-test-results');
const baselineDir = path.join(resultsDir, 'baseline');
const candidateDir = path.join(resultsDir, 'candidate');
const updateBaseline = process.env.MCP_EVAL_UPDATE_BASELINE === '1';
const compareBaseline = process.env.MCP_EVAL_COMPARE_BASELINE === '1';

interface JudgeOutcome {
  pass: boolean;
  details?: string;
  judgeResults?: { details?: string }[];
}

interface Trial {
  pass: boolean;
  error?: string;
  isInfrastructureError?: boolean;
  mcpHostTrace?: {
    calls: { name: string; status: string }[];
    missed: { name: string }[];
  };
  expectations?: { judge?: JudgeOutcome };
}

interface CaseOutcome extends Trial {
  id: string;
  assertionPassRate?: number;
  iterationResults?: Trial[];
}

interface SavedRun {
  caseResults: CaseOutcome[];
}

function baselineFile(id: string): string {
  return path.join(baselineDir, `${id}.json`);
}

// MST records judge failures under expectations, not trial.error, so judge
// outages need their own check.
function judgeOutage(trial: Trial): boolean {
  const judge = trial.expectations?.judge;
  const messages = [
    judge?.details,
    ...(judge?.judgeResults ?? []).map((r) => r.details),
  ];
  return messages.some((m) => m !== undefined && OUTAGE_PATTERN.test(m));
}

function isOutage(trial: Trial): boolean {
  return (
    trial.isInfrastructureError === true ||
    (trial.error !== undefined && OUTAGE_PATTERN.test(trial.error)) ||
    judgeOutage(trial)
  );
}

// Playwright prints only the failed assertion, so the message carries each
// distinct trial error and the tools the model called or missed.
function failureSummary(trials: Trial[]): string {
  const failed = trials.filter((t) => !t.pass);
  if (failed.length === 0) return 'case below accuracy threshold';
  const errors = new Map<string, number>();
  for (const t of failed) {
    const key = (t.error ?? 'assertion failed').slice(0, 300);
    errors.set(key, (errors.get(key) ?? 0) + 1);
  }
  const first = failed.find((t) => t.mcpHostTrace)?.mcpHostTrace;
  const trace = first
    ? `\nfirst failing trace: calls [${first.calls.map((c) => `${c.name}:${c.status}`).join(', ')}], missed [${first.missed.map((m) => m.name).join(', ')}]`
    : '';
  const lines = [...errors].map(([msg, n]) => `  ${n}x ${msg}`);
  return `${failed.length}/${trials.length} trials failed:\n${lines.join('\n')}${trace}`;
}

function trialRate(outcome: CaseOutcome): number {
  return outcome.assertionPassRate ?? (outcome.pass ? 1 : 0);
}

function baselineRate(id: string): number {
  const saved = JSON.parse(readFileSync(baselineFile(id), 'utf8')) as SavedRun;
  const entry = saved.caseResults.find((c) => c.id === id);
  if (!entry) throw new Error(`Baseline for ${id} has no entry for ${id}`);
  return trialRate(entry);
}

// Timings, usage, and git metadata change on every run, so they are removed
// before a baseline is committed. Session ids and the fixture root are
// replaced because they are assigned per run.
const RUN_SPECIFIC_KEYS = new Set([
  'timestamp',
  'gitHash',
  'durationMs',
  'hostUsage',
  'totalHostUsage',
]);

function stripRunSpecific(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRunSpecific);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !RUN_SPECIFIC_KEYS.has(key))
        .map(([key, nested]) => [key, stripRunSpecific(nested)]),
    );
  }
  return value;
}

function normalizeForBaseline(text: string): string {
  return (
    JSON.stringify(stripRunSpecific(JSON.parse(text)), null, 2)
      .replaceAll(EVAL_LAYOUT.root, '<fixture-root>')
      .replace(/ses_[A-Za-z0-9]+/g, '<session-id>') + '\n'
  );
}

for (const { id } of buildEvalDataset(placeholder).cases) {
  test(id, async ({ mcp }, testInfo) => {
    if (updateBaseline && compareBaseline) {
      throw new Error(
        'Set only one of MCP_EVAL_UPDATE_BASELINE and MCP_EVAL_COMPARE_BASELINE',
      );
    }
    const dataset = buildEvalDataset(readState(EVAL_LAYOUT));
    const evalCase = dataset.cases.find((c) => c.id === id);
    if (!evalCase) throw new Error(`Unknown eval case: ${id}`);
    const iterations = evalCase.iterations ?? DEFAULT_ITERATIONS;
    testInfo.setTimeout(iterations * MS_PER_ITERATION + STALL_BUDGET_MS);

    if (compareBaseline && !existsSync(baselineFile(id))) {
      throw new Error(
        `No baseline for ${id} at ${baselineFile(id)}. Run with MCP_EVAL_UPDATE_BASELINE=1 first.`,
      );
    }
    mkdirSync(resultsDir, { recursive: true });
    mkdirSync(baselineDir, { recursive: true });
    mkdirSync(candidateDir, { recursive: true });

    // Update runs write to a candidate file. It becomes the baseline only when
    // every trial passes, so a failing run cannot overwrite a good baseline.
    const resultFile = updateBaseline
      ? path.join(candidateDir, `${id}.json`)
      : path.join(resultsDir, `${id}.json`);

    const result = await runEvalDataset(
      {
        dataset: { ...dataset, cases: [evalCase] },
        defaultLlmIterations: DEFAULT_ITERATIONS,
        defaultJudgeReps: Number(process.env.MCP_EVAL_JUDGE_REPS ?? 1),
        saveResultsTo: resultFile,
        ...(compareBaseline ? { baselineResultsFrom: baselineFile(id) } : {}),
      },
      { mcp, testInfo },
    );

    const caseResult = result.caseResults[0];
    if (!caseResult) throw new Error(`No result recorded for ${id}`);
    const trials = caseResult.iterationResults ?? [];
    const outageCount =
      trials.length > 0
        ? trials.filter(isOutage).length
        : isOutage(caseResult)
          ? 1
          : 0;

    if (updateBaseline) {
      const everyTrialPassed =
        trials.length > 0 ? trials.every((t) => t.pass) : result.failed === 0;
      if (everyTrialPassed && outageCount === 0) {
        writeFileSync(
          baselineFile(id),
          normalizeForBaseline(readFileSync(resultFile, 'utf8')),
          'utf8',
        );
      } else {
        console.log(
          `Baseline for ${id} not written: every trial must pass with no infrastructure error. Candidate kept at ${resultFile}.`,
        );
      }
    }

    if (compareBaseline) {
      // The case passes at the accuracy threshold, so 8 of 10 trials can pass.
      // Comparing the rate catches a drop that the case-level pass hides.
      const baseline = baselineRate(id);
      const current = trialRate(caseResult);
      expect(
        current,
        `pass rate ${current} fell below baseline ${baseline} by more than ${RATE_TOLERANCE}`,
      ).toBeGreaterThanOrEqual(baseline - RATE_TOLERANCE - 1e-9);
    }
    // Infrastructure errors are excluded from the pass rate, so mostly-outage
    // runs could otherwise pass on a single trial.
    expect(outageCount, 'infrastructure errors in this case').toBe(0);
    expect(result.failed, failureSummary(trials)).toBe(0);
  });
}
