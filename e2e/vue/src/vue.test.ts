import {
  cleanupProject,
  killPorts,
  newProject,
  promisifiedTreeKill,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  uniq,
} from '@nx/e2e/utils';

const myApp = uniq('my-app');
const myLib = uniq('my-lib');

describe('Vue Plugin', () => {
  let proj: string;

  describe('Vite on React apps', () => {
    describe('successfully create and serve a vue app', () => {
      beforeEach(() => {
        proj = newProject({
          unsetProjectNameAndRootFormat: false,
        });
        runCLI(`generate @nx/vue:app ${myApp}`);
        runCLI(`generate @nx/vue:lib ${myLib} --bundler=vite`);
      });
      afterEach(() => cleanupProject());

      it('should serve application in dev mode', async () => {
        const p = await runCommandUntil(`run ${myApp}:serve`, (output) => {
          return output.includes('Local:');
        });
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(4200);
        } catch (e) {
          // ignore
        }
      }, 200_000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });

      it('should build application', async () => {
        const result = await runCLIAsync(`build ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target build for project ${myApp}`
        );
      });

      it('should build library', async () => {
        const result = await runCLIAsync(`build ${myLib}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target build for project ${myLib}`
        );
      });
    });
  });
});
