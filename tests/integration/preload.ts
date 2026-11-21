import { afterAll } from 'bun:test';
import {
  startFixtures,
  stopFixtures,
  teardownFixturesSync,
} from './fixtures.js';

if (process.env.OPENCODE_PEER_MCP_SKIP_FIXTURES !== '1') {
  process.once('SIGINT', () => {
    teardownFixturesSync();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    teardownFixturesSync();
    process.exit(143);
  });
  afterAll(stopFixtures);
  await startFixtures();
}
