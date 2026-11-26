import type { FixtureLayout } from '../integration/fixtures.js';

export const EVAL_LAYOUT: FixtureLayout = {
  root:
    process.env.OPENCODE_PEER_MCP_EVAL_ROOT ?? '/tmp/opencode-peer-mcp-evals',
  alphaPort: 49431,
  betaPort: 49432,
  gammaPort: 49434,
  modelPort: 49433,
};
