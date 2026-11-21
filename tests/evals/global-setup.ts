import { randomBytes } from 'node:crypto';
import { startFixtures, stopFixtures } from '../integration/fixtures.js';
import { startGoProxy, type GoProxy } from './go-proxy.js';
import { EVAL_LAYOUT } from './layout.js';

// Playwright runs the returned function as global teardown.
export default async function globalSetup(): Promise<() => Promise<void>> {
  const routeToGo =
    (process.env.MCP_EVAL_PROVIDER ?? 'openai') === 'openai' &&
    !process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENCODE_GO_API_KEY;
  if (routeToGo && !apiKey) {
    throw new Error(
      'OPENCODE_GO_API_KEY is required to run evals through OpenCode Go. Set OPENAI_BASE_URL to use another endpoint.',
    );
  }

  await startFixtures(EVAL_LAYOUT);
  let proxy: GoProxy | undefined;
  try {
    if (routeToGo && apiKey) {
      const clientToken = randomBytes(24).toString('hex');
      proxy = await startGoProxy({ apiKey, clientToken });
      process.env.OPENAI_BASE_URL = proxy.baseUrl;
      process.env.OPENAI_API_KEY = clientToken;
    }
  } catch (error) {
    await stopFixtures(EVAL_LAYOUT).catch(() => undefined);
    throw error;
  }

  return async () => {
    try {
      await proxy?.close();
    } finally {
      await stopFixtures(EVAL_LAYOUT);
    }
  };
}
