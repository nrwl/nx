import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  runCLI,
  runCommandUntil,
  uniq,
} from '@nx/e2e-utils';
import { ChildProcess } from 'child_process';

describe('Vite Plugin', () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';
    proj = newProject({
      packages: ['@nx/react', '@nx/web'],
    });
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe('should be able to create libs that use vitest', () => {
    describe('using default project configuration', () => {
      const lib = uniq('my-default-lib');
      beforeAll(() => {
        proj = newProject({ name: uniq('vite-proj'), packages: ['@nx/react'] });
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
      });

      it('should collect coverage when --coverage is set', () => {
        const results = runCLI(`test ${lib} --coverage`);
        expect(results).toContain(`Coverage report`);
      }, 100_000);

      it('should be able to watch tests', async () => {
        let cp: ChildProcess;
        try {
          cp = await runCommandUntil(`test ${lib} --watch`, (output) => {
            return output.includes('Waiting for file changes...');
          });
        } catch (error) {
          console.error(error);
        }

        if (cp && cp.pid) {
          await killProcessAndPorts(cp.pid);
        }
      }, 100_000);

      it('should not watch tests when --watch is not set', async () => {
        const results = runCLI(`test ${lib}`);

        expect(results).not.toContain('Waiting for file changes...');

        expect(results).toContain(
          `Successfully ran target test for project ${lib}`
        );
      }, 100_000);
    });
  });
});
