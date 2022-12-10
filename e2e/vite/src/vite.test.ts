import {
  cleanupProject,
  createFile,
  exists,
  fileExists,
  killPorts,
  listFiles,
  newProject,
  promisifiedTreeKill,
  readFile,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

const myApp = uniq('my-app');

describe('Vite Plugin', () => {
  let proj: string;

  describe('Vite on React apps', () => {
    describe('convert React webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/react:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nrwl/vite:configuration ${myApp}`);
      });
      afterEach(() => cleanupProject());

      it('should serve application in dev mode with custom options', async () => {
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port} --https=true`,
          (output) => {
            return (
              output.includes('Local:') &&
              output.includes(`:${port}`) &&
              output.includes('https')
            );
          }
        );
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch {
          // ignore
        }
      }, 200000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    });

    describe('set up new React app with --bundler=vite option', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/react:app ${myApp} --bundler=vite`);
        createFile(`apps/${myApp}/public/hello.md`, `# Hello World`);
        updateFile(
          `apps/${myApp}/src/environments/environment.prod.ts`,
          `export const environment = {
            production: true,
            myTestVar: 'MyProductionValue',
          };`
        );
        updateFile(
          `apps/${myApp}/src/environments/environment.ts`,
          `export const environment = {
            production: false,
            myTestVar: 'MyDevelopmentValue',
          };`
        );

        updateFile(
          `apps/${myApp}/src/app/app.tsx`,
          `
            import { environment } from './../environments/environment';
            export function App() {
              return (
                <>
                  <h1>{environment.myTestVar}</h1>
                  <p>Welcome ${myApp}!</p>
                </>
              );
            }
            export default App;
          `
        );

        updateProjectConfig(myApp, (config) => {
          config.targets.build.options.fileReplacements = [
            {
              replace: `apps/${myApp}/src/environments/environment.ts`,
              with: `apps/${myApp}/src/environments/environment.prod.ts`,
            },
          ];
          return config;
        });
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/apps/${myApp}/favicon.ico`)).toBeDefined();
        expect(readFile(`dist/apps/${myApp}/hello.md`)).toBeDefined();
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).toContain(
          'MyProductionValue'
        );
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).not.toContain('MyDevelopmentValue');
        rmDist();
      }, 200000);
    });
  });

  describe('Vite on Web apps', () => {
    describe('set up new @nrwl/web app with --bundler=vite option', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/web:app ${myApp} --bundler=vite`);
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        expect(fileExists(`dist/apps/${myApp}/package.json`)).toBeFalsy();
        rmDist();
      }, 200_000);
    });

    describe('convert @nrwl/web webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nrwl/web:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nrwl/vite:configuration ${myApp}`);
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        rmDist();
      }, 200000);

      it('should serve application in dev mode with custom port', async () => {
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port}`,
          (output) => {
            return output.includes('Local:') && output.includes(`:${port}`);
          }
        );
        try {
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch {
          // ignore
        }
      }, 200000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    }),
      100_000;
  });

  describe('should be able to create libs that use vitest', () => {
    const lib = uniq('my-lib');
    beforeEach(() => {
      proj = newProject();
    }),
      100_000;

    it('should be able to run tests', async () => {
      runCLI(`generate @nrwl/react:lib ${lib} --unitTestRunner=vitest`);
      expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();

      const result = await runCLIAsync(`test ${lib}`);
      expect(result.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );
    }, 100_000);

    it('should be able to run tests with inSourceTests set to true', async () => {
      runCLI(
        `generate @nrwl/react:lib ${lib} --unitTestRunner=vitest --inSourceTests`
      );
      expect(
        exists(tmpProjPath(`libs/${lib}/src/lib/${lib}.spec.tsx`))
      ).toBeFalsy();

      updateFile(`libs/${lib}/src/lib/${lib}.tsx`, (content) => {
        content += `
        if (import.meta.vitest) {
          const { expect, it } = import.meta.vitest;
          it('should be successful', () => {
            expect(1 + 1).toBe(2);
          });
        }
        `;
        return content;
      });

      const result = await runCLIAsync(`test ${lib}`);
      expect(result.combinedOutput).toContain(`1 passed`);
    }, 100_000);
  });
});
