import {
  applyDaemonEnvFromClient,
  getDaemonClientEnvGeneration,
  getDaemonEnv,
  hashDaemonClientEnv,
} from './daemon-environment';

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

  describe('getDaemonClientEnvGeneration', () => {
    it('moves only when an apply changes the env', () => {
      const base = getDaemonClientEnvGeneration();
      const withProbe = { ...process.env, GEN_PROBE: 'a' };
      applyDaemonEnvFromClient(withProbe);
      expect(getDaemonClientEnvGeneration()).toBe(base + 1);
      // The same env again changes nothing, so the count must hold: a pass
      // spanning only no-op applies must still be allowed to persist.
      applyDaemonEnvFromClient(withProbe);
      expect(getDaemonClientEnvGeneration()).toBe(base + 1);
    });
  });

  describe('hashDaemonClientEnv', () => {
    it('changes when an allowed env var changes value, appears, or disappears', () => {
      delete process.env.SOME_TOOL_HOME;
      const without = hashDaemonClientEnv();
      process.env.SOME_TOOL_HOME = '/usr/lib/tool';
      const withVar = hashDaemonClientEnv();
      expect(withVar).not.toEqual(without);
      process.env.SOME_TOOL_HOME = '/opt/tool';
      expect(hashDaemonClientEnv()).not.toEqual(withVar);
      delete process.env.SOME_TOOL_HOME;
      expect(hashDaemonClientEnv()).toEqual(without);
    });

    it('is stable when an excluded env var changes', () => {
      delete process.env.NX_TUI;
      delete process.env.ITERM_SESSION_ID;
      const base = hashDaemonClientEnv();
      process.env.NX_TUI = 'true';
      process.env.ITERM_SESSION_ID = 'w0t1p0:12345';
      expect(hashDaemonClientEnv()).toEqual(base);
    });

    it('changes when a prefix-exclusion override changes', () => {
      delete process.env.NX_CLOUD_ACCESS_TOKEN;
      const base = hashDaemonClientEnv();
      process.env.NX_CLOUD_ACCESS_TOKEN = 'token';
      expect(hashDaemonClientEnv()).not.toEqual(base);
    });

    // The daemon pins the required settings into its own and every plugin
    // worker's env while daemonless plugin workers typically lack them;
    // skipping them keeps the digest identical across modes.
    it('is stable when a required daemon setting changes', () => {
      delete process.env.NX_PROJECT_GLOB_CACHE;
      const base = hashDaemonClientEnv();
      process.env.NX_PROJECT_GLOB_CACHE = 'false';
      expect(hashDaemonClientEnv()).toEqual(base);
    });

    // Pins that the overridable settings need no dedicated skip like the
    // required ones above: they are already in the exclusion set.
    it('is stable when an overridable daemon setting changes', () => {
      delete process.env.NX_VERBOSE_LOGGING;
      const base = hashDaemonClientEnv();
      process.env.NX_VERBOSE_LOGGING = 'true';
      expect(hashDaemonClientEnv()).toEqual(base);
    });
  });
});
