import { applyDaemonEnvFromClient, getDaemonEnv } from './daemon-environment';

describe('daemon environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // NX_LOAD_DOT_ENV_FILES must reach the daemon so createNodes resolves task
  // dotenv the way the task will, and so the user's 'false' opt-out is honored
  // at graph-construction time. It reads like a task-scoped var that cannot
  // affect the graph, so guard against it being re-added to the exclusions.
  describe('NX_LOAD_DOT_ENV_FILES', () => {
    it('is forwarded to the daemon env', () => {
      process.env.NX_LOAD_DOT_ENV_FILES = 'false';
      expect(getDaemonEnv().NX_LOAD_DOT_ENV_FILES).toBe('false');
    });

    it('is cleared when a later client omits it (last-client-wins)', () => {
      // Or the new client's graph would run with the previous client's opt-out.
      process.env.NX_LOAD_DOT_ENV_FILES = 'false';
      const changed = applyDaemonEnvFromClient({});
      expect(process.env.NX_LOAD_DOT_ENV_FILES).toBeUndefined();
      expect(changed).toContain('NX_LOAD_DOT_ENV_FILES');
    });
  });
});
