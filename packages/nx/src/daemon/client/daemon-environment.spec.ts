import { applyDaemonEnvFromClient, getDaemonEnv } from './daemon-environment';

describe('daemon environment', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDaemonEnv', () => {
    it.each(['JAVA_HOME', 'PATH', 'NODE_PATH'])('should forward %s', (key) => {
      process.env[key] = '/set/by/the/client';

      expect(getDaemonEnv()[key]).toEqual('/set/by/the/client');
    });

    it.each([
      'AI_AGENT',
      'NX_CONSOLE',
      'INIT_CWD',
      'MISE_SHELL',
      'PNPM_HOME',
      'COREPACK_ENABLE_STRICT',
      'CLAUDE_CODE_ENTRYPOINT',
      'COPILOT_AGENT_ID',
      'CURSOR_TRACE_ID',
      'GIT_INDEX_FILE',
    ])('should not forward %s', (key) => {
      process.env[key] = 'set-by-the-client';

      expect(getDaemonEnv()).not.toHaveProperty(key);
    });
  });

  describe('applyDaemonEnvFromClient', () => {
    it.each(['PATH', 'NODE_PATH'])(
      'should apply a new %s without reporting it as changed',
      (key) => {
        process.env[key] = '/from/the/daemon';

        expect(
          applyDaemonEnvFromClient({
            ...process.env,
            [key]: '/from/the/client',
          })
        ).toEqual([]);
        expect(process.env[key]).toEqual('/from/the/client');
      }
    );

    it('should report a changed var that can affect the project graph', () => {
      process.env.JAVA_HOME = '/opt/java-21';

      expect(
        applyDaemonEnvFromClient({
          ...process.env,
          JAVA_HOME: '/opt/java-24',
        })
      ).toEqual(['JAVA_HOME']);
    });

    it('should report no changes for a client env differing only in excluded vars', () => {
      process.env.JAVA_HOME = '/opt/java';
      const daemonEnv = getDaemonEnv();

      process.env.PNPM_HOME = '/pnpm';
      process.env.GIT_INDEX_FILE = '/repo/.git/index';
      const clientEnv = getDaemonEnv();

      process.env = daemonEnv;

      expect(applyDaemonEnvFromClient(clientEnv)).toEqual([]);
    });
  });
});
