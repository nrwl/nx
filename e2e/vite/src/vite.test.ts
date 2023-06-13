import {
  cleanupProject,
  createFile,
  directoryExists,
  exists,
  fileExists,
  killPorts,
  listFiles,
  newProject,
  promisifiedTreeKill,
  readFile,
  readJson,
  rmDist,
  runCLI,
  runCLIAsync,
  runCommandUntil,
  tmpProjPath,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nx/e2e/utils';

const myApp = uniq('my-app');
const previousVerboseValue = process.env.NX_VERBOSE_LOGGING;

describe('Vite Plugin', () => {
  let proj: string;
  beforeAll(() => {
    process.env.NX_VERBOSE_LOGGING = 'true';
  });
  afterAll(() => {
    process.env.NX_VERBOSE_LOGGING = previousVerboseValue;
  });

  describe('Vite on React apps', () => {
    describe('convert React webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        console.log('Testing_A 1');
        proj = newProject();
        console.log('Testing_A proj', proj);

        console.log('Testing_A 2');

        runCLI(`generate @nx/react:app ${myApp} --bundler=webpack`);
        console.log('Testing_A 3');

        runCLI(`generate @nx/vite:configuration ${myApp}`);
        console.log('Testing_A 4');
      });
      afterEach(() => cleanupProject());

      it('should serve application in dev mode with custom options', async () => {
        console.log('Testing_A 5');

        const port = 4212;
        console.log('Testing_A 6');
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port} --https=true`,
          (output) => {
            console.log('Testing_A 7');
            return (
              output.includes('Local:') &&
              output.includes(`:${port}`) &&
              output.includes('https')
            );
          }
        );
        try {
          console.log('Testing_A 8');
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          await killPorts(port);
        } catch (e) {
          console.log('Testing_A 9');
          console.log('Testing_A e', e);
          // ignore
        }
      }, 200_000);

      it('should test application', async () => {
        const result = await runCLIAsync(`test ${myApp}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${myApp}`
        );
      });
    });

    describe('set up new React app with --bundler=vite option', () => {
      beforeEach(() => {
        console.log('Testing_X 1');
        proj = newProject();
        console.log('Testing_X 2');
        runCLI(`generate @nx/react:app ${myApp} --bundler=vite`);
        console.log('Testing_X 3');
        createFile(`apps/${myApp}/public/hello.md`, `# Hello World`);
        console.log('Testing_X 4');
        updateFile(
          `apps/${myApp}/src/environments/environment.prod.ts`,
          `export const environment = {
            production: true,
            myTestVar: 'MyProductionValue',
          };`
        );
        console.log('Testing_X 5');
        updateFile(
          `apps/${myApp}/src/environments/environment.ts`,
          `export const environment = {
            production: false,
            myTestVar: 'MyDevelopmentValue',
          };`
        );
        console.log('Testing_X 6');

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
        console.log('Testing_X 7');

        updateProjectConfig(myApp, (config) => {
          config.targets.build.options.fileReplacements = [
            {
              replace: `apps/${myApp}/src/environments/environment.ts`,
              with: `apps/${myApp}/src/environments/environment.prod.ts`,
            },
          ];
          return config;
        });
        console.log('Testing_X 8');
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        console.log('Testing_X 9');
        runCLI(`build ${myApp}`);
        console.log('Testing_X 10');
        expect(readFile(`dist/apps/${myApp}/favicon.ico`)).toBeDefined();
        expect(readFile(`dist/apps/${myApp}/hello.md`)).toBeDefined();
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        console.log('Testing_X 11');
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        console.log('Testing_X 12');
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        console.log('Testing_X 13');
        expect(readFile(`dist/apps/${myApp}/assets/${mainBundle}`)).toContain(
          'MyProductionValue'
        );
        console.log('Testing_X 14');
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).not.toContain('MyDevelopmentValue');
        console.log('Testing_X 15');
        rmDist();
      }, 200_000);
    });
  });

  describe('Vite on Web apps', () => {
    describe('set up new @nx/web app with --bundler=vite option', () => {
      beforeEach(() => {
        console.log('Testing_Y 1');
        proj = newProject();
        console.log('Testing_Y 2');
        runCLI(`generate @nx/web:app ${myApp} --bundler=vite`);
        console.log('Testing_Y 3');
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        console.log('Testing_Y 4');
        runCLI(`build ${myApp}`);
        console.log('Testing_Y 5');
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        console.log('Testing_Y 6');
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        console.log('Testing_Y 7');
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        console.log('Testing_Y 8');
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        expect(fileExists(`dist/apps/${myApp}/package.json`)).toBeFalsy();
        rmDist();
      }, 200_000);

      it('should build application with new package json generation', async () => {
        console.log('Testing_Y 9');
        runCLI(`build ${myApp} --generatePackageJson`);
        console.log('Testing_Y 10');
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        console.log('Testing_Y 11');
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        console.log('Testing_Y 12');
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();

        const packageJson = readJson(`dist/apps/${myApp}/package.json`);
        console.log('Testing_Y 13');
        expect(packageJson).toEqual({
          name: myApp,
          version: '0.0.1',
          type: 'module',
        });
        rmDist();
      }, 200_000);

      it('should build application with existing package json generation', async () => {
        console.log('Testing_Y 14');
        createFile(
          `apps/${myApp}/package.json`,
          JSON.stringify({
            name: 'my-existing-app',
            version: '1.0.1',
            scripts: {
              start: 'node server.js',
            },
          })
        );
        console.log('Testing_Y 15');
        runCLI(`build ${myApp} --generatePackageJson`);
        console.log('Testing_Y 16');
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();

        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        console.log('Testing_Y 17');
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();

        const packageJson = readJson(`dist/apps/${myApp}/package.json`);
        expect(packageJson).toEqual({
          name: 'my-existing-app',
          version: '1.0.1',
          type: 'module',
          scripts: {
            start: 'node server.js',
          },
        });
        rmDist();
      }, 200_000);
    });

    describe('convert @nx/web webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        console.log('Testing_Z 00');
        proj = newProject();
        console.log('Testing_Z 01');

        runCLI(`generate @nx/web:app ${myApp} --bundler=webpack`);
        console.log('Testing_Z 02');
        runCLI(`generate @nx/vite:configuration ${myApp}`);
        console.log('Testing_Z 03');
      });
      afterEach(() => cleanupProject());
      it('should build application', async () => {
        console.log('Testing_Z 04');
        runCLI(`build ${myApp}`);
        console.log('Testing_Z 05');
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        console.log('Testing_Z 06');
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();
        rmDist();
      }, 200_000);

      it('should serve application in dev mode with custom port', async () => {
        console.log('Testing_Z 1');
        const port = 4212;
        const p = await runCommandUntil(
          `run ${myApp}:serve --port=${port}`,
          (output) => {
            return output.includes('Local:') && output.includes(`:${port}`);
          }
        );
        console.log('Testing_Z 2');

        try {
          console.log('Testing_Z 3');
          await promisifiedTreeKill(p.pid, 'SIGKILL');
          console.log('Testing_Z 4');
          await killPorts(port);
        } catch (e) {
          console.log('Testing_Z 5');
          console.log('The error', e);
          // ignore
        }
      }, 200_000);

      it('should test application', async () => {
        console.log('Testing_Z 6');
        const result = await runCLIAsync(`test ${myApp}`);
        console.log('Testing_Z 7');
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
      console.log('Testing_Z 8');
      proj = newProject({ name: uniq('vite-proj') });
      console.log('Testing_Z 9');
    }),
      100_000;

    it('should be able to run tests', async () => {
      console.log('Testing_Z 10');
      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
      console.log('Testing_Z 11');
      expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();
      console.log('Testing_Z 12');
      const result = await runCLIAsync(`test ${lib}`);
      console.log('Testing_Z 13');
      expect(result.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );
      console.log('Testing_Z 14');
      // TODO(caleb): run tests from project root and make sure they still work
      const nestedResults = await runCLIAsync(`test ${lib} --skip-nx-cache`, {
        cwd: `${tmpProjPath()}/libs/${lib}`,
      });
      console.log('Testing_Z 15');
      expect(nestedResults.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );
    }, 100_000);

    it('should collect coverage', () => {
      console.log('Testing_Z 16');
      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
      console.log('Testing_Z 17');
      updateFile(`libs/${lib}/vite.config.ts`, () => {
        return `/// <reference types="vitest" />
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import viteTsConfigPaths from 'vite-tsconfig-paths';

        export default defineConfig({
          server: {
            port: 4200,
            host: 'localhost',
          },
          plugins: [
            react(),
            viteTsConfigPaths({
              root: './',
            }),
          ],
          test: {
            globals: true,
            cache: {
              dir: './node_modules/.vitest',
            },
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            coverage: {
              provider: "c8",
              enabled: true,
              lines: 100,
              statements: 100,
              functions: 100,
              branches: 1000,
            }
          },
        });
        `;
      });
      console.log('Testing_Z 18');
      const coverageDir = `${tmpProjPath()}/coverage/libs/${lib}`;
      console.log('Testing_Z 19');
      const results = runCLI(`test ${lib} --coverage`, { silenceError: true });
      expect(results).toContain(
        `Running target test for project ${lib} failed`
      );
      console.log('Testing_Z 20');

      expect(results).toContain(`ERROR: Coverage`);
      expect(directoryExists(coverageDir)).toBeTruthy();
    }, 100_000);

    it('should not delete the project directory when coverage is enabled', () => {
      // when coverage is enabled in the vite.config.ts but reportsDirectory is removed
      // from the @nx/vite:test executor options, vite will delete the project root directory
      console.log('Testing_Z 21');

      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
      console.log('Testing_Z 22');
      updateFile(`libs/${lib}/vite.config.ts`, () => {
        return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  server: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [
    react(),
    viteTsConfigPaths({
      root: './',
    }),
  ],
  test: {
    globals: true,
    cache: {
      dir: './node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['junit'],
    outputFile: 'junit.xml',
    coverage: {
      enabled: true,
      reportsDirectory: 'coverage',
    }
  },
});
`;
      });
      console.log('Testing_Z 23');
      updateProjectConfig(lib, (config) => {
        delete config.targets.test.options.reportsDirectory;
        return config;
      });

      const projectRoot = `${tmpProjPath()}/libs/${lib}`;
      console.log('Testing_Z 24');

      const results = runCLI(`test ${lib}`);

      expect(directoryExists(projectRoot)).toBeTruthy();
      expect(results).toContain(
        `Successfully ran target test for project ${lib}`
      );
      expect(results).toContain(`JUNIT report written`);
    }, 100_000);

    it('should be able to run tests with inSourceTests set to true', async () => {
      console.log('Testing_Z 25');
      runCLI(
        `generate @nx/react:lib ${lib} --unitTestRunner=vitest --inSourceTests`
      );
      console.log('Testing_Z 26');
      expect(
        exists(tmpProjPath(`libs/${lib}/src/lib/${lib}.spec.tsx`))
      ).toBeFalsy();

      console.log('Testing_Z 27');
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
