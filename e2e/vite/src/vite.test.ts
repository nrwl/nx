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

describe('Vite Plugin', () => {
  let proj: string;

  describe('Vite on React apps', () => {
    describe('convert React webpack app to vite using the vite:configuration generator', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nx/react:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nx/vite:configuration ${myApp}`);
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
    });

    describe('set up new React app with --bundler=vite option', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nx/react:app ${myApp} --bundler=vite`);
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
      }, 200_000);
    });
  });

  describe('Vite on Web apps', () => {
    describe('set up new @nx/web app with --bundler=vite option', () => {
      beforeEach(() => {
        proj = newProject();
        runCLI(`generate @nx/web:app ${myApp} --bundler=vite`);
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

      it('should build application with new package json generation', async () => {
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(
          readFile(`dist/apps/${myApp}/assets/${mainBundle}`)
        ).toBeDefined();

        const packageJson = readJson(`dist/apps/${myApp}/package.json`);
        expect(packageJson).toEqual({
          name: myApp,
          version: '0.0.1',
          type: 'module',
        });
        rmDist();
      }, 200_000);

      it('should build application with existing package json generation', async () => {
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
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/apps/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/apps/${myApp}/assets`);
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
        proj = newProject();
        runCLI(`generate @nx/web:app ${myApp} --bundler=webpack`);
        runCLI(`generate @nx/vite:configuration ${myApp}`);
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
      }, 200_000);

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
      }, 200_000);

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
      proj = newProject({ name: uniq('vite-proj') });
    });

    it('should be able to run tests', async () => {
      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
      expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();

      const result = await runCLIAsync(`test ${lib}`);
      expect(result.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );

      // TODO(caleb): run tests from project root and make sure they still work
      const nestedResults = await runCLIAsync(`test ${lib} --skip-nx-cache`, {
        cwd: `${tmpProjPath()}/libs/${lib}`,
      });
      expect(nestedResults.combinedOutput).toContain(
        `Successfully ran target test for project ${lib}`
      );
    }, 100_000);

    it('should collect coverage', () => {
      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
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

      const coverageDir = `${tmpProjPath()}/coverage/libs/${lib}`;

      const results = runCLI(`test ${lib} --coverage`, { silenceError: true });
      expect(results).toContain(
        `Running target test for project ${lib} failed`
      );
      expect(results).toContain(`ERROR: Coverage`);
      expect(directoryExists(coverageDir)).toBeTruthy();
    }, 100_000);

    // TODO: This takes forever and times out everything - find out why
    xit('should not delete the project directory when coverage is enabled', () => {
      // when coverage is enabled in the vite.config.ts but reportsDirectory is removed
      // from the @nx/vite:test executor options, vite will delete the project root directory
      runCLI(`generate @nx/react:lib ${lib} --unitTestRunner=vitest`);
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
      updateProjectConfig(lib, (config) => {
        delete config.targets.test.options.reportsDirectory;
        return config;
      });

      const projectRoot = `${tmpProjPath()}/libs/${lib}`;

      const results = runCLI(`test ${lib}`);

      expect(directoryExists(projectRoot)).toBeTruthy();
      expect(results).toContain(
        `Successfully ran target test for project ${lib}`
      );
      expect(results).toContain(`JUNIT report written`);
    }, 100_000);

    it('should be able to run tests with inSourceTests set to true', async () => {
      runCLI(
        `generate @nx/react:lib ${lib} --unitTestRunner=vitest --inSourceTests`
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
