import { afterAll } from 'bun:test';
import {
  startFixtures,
  stopFixtures,
  teardownFixturesSync,
} from './fixtures.js';

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
