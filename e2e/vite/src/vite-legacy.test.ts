import { names } from '@nx/devkit';
import {
  cleanupProject,
  createFile,
  directoryExists,
  exists,
  fileExists,
  getPackageManagerCommand,
  listFiles,
  newProject,
  readFile,
  readJson,
  removeFile,
  rmDist,
  runCLI,
  runCommand,
  runCommandUntil,
  runCLIAsync,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
  checkFilesExist,
  killProcessAndPorts,
} from '@nx/e2e/utils';
import { join } from 'path';
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

  describe('Vite on React apps', () => {
    describe('set up new React app with --bundler=vite option', () => {
      let myApp;

      beforeAll(() => {
        myApp = uniq('my-app');
        runCLI(`generate @nx/react:app ${myApp} --bundler=vite`);
      });

      afterEach(() => {
        rmDist();
      });

      describe('build the app', () => {
        it('should build application', async () => {
          runCLI(`build ${myApp}`);
          expect(readFile(`dist/${myApp}/favicon.ico`)).toBeDefined();
          expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        }, 200_000);

        describe('when the app has static assets', () => {
          beforeAll(() => {
            createFile(`${myApp}/public/hello.md`, `# Hello World`);
          });

          afterAll(() => {
            removeFile(`${myApp}/public/hello.md`);
          });

          it('should copy the assets to the output path', async () => {
            runCLI(`build ${myApp}`);
            expect(readFile(`dist/${myApp}/favicon.ico`)).toBeDefined();
            expect(readFile(`dist/${myApp}/hello.md`)).toBeDefined();
            expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
          }, 200_000);
        });
      });

      describe('test the app', () => {
        it('should test application', async () => {
          const result = runCLI(`test ${myApp}`);
          expect(result).toContain('Successfully ran target test');
        }, 200_000);
      });
    });
  });

  describe('Vite on Web apps', () => {
    describe('set up new @nx/web app with --bundler=vite option', () => {
      let myApp;
      beforeEach(() => {
        myApp = uniq('my-app');
        runCLI(
          `generate @nx/web:app ${myApp} --bundler=vite --directory=${myApp}`
        );
      });
      it('should build application', async () => {
        runCLI(`build ${myApp}`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();
        expect(fileExists(`dist/${myApp}/package.json`)).toBeFalsy();
        rmDist();
      }, 200_000);

      it('should build application with new package json generation', async () => {
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        const packageJson = readJson(`dist/${myApp}/package.json`);
        expect(packageJson).toEqual({
          name: myApp,
          version: '0.0.1',
          type: 'module',
        });
        rmDist();
      }, 200_000);

      it('should build application with existing package json generation', async () => {
        createFile(
          `${myApp}/package.json`,
          JSON.stringify({
            name: 'my-existing-app',
            version: '1.0.1',
            scripts: {
              start: 'node server.js',
            },
          })
        );
        runCLI(`build ${myApp} --generatePackageJson`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        const packageJson = readJson(`dist/${myApp}/package.json`);
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

      it('should build application without copying exisiting package json when generatePackageJson=false', async () => {
        createFile(
          `${myApp}/package.json`,
          JSON.stringify({
            name: 'my-existing-app',
            version: '1.0.1',
            scripts: {
              start: 'node server.js',
            },
          })
        );
        runCLI(`build ${myApp} --generatePackageJson=false`);
        expect(readFile(`dist/${myApp}/index.html`)).toBeDefined();
        const fileArray = listFiles(`dist/${myApp}/assets`);
        const mainBundle = fileArray.find((file) => file.endsWith('.js'));
        expect(readFile(`dist/${myApp}/assets/${mainBundle}`)).toBeDefined();

        expect(fileExists(`dist/${myApp}/package.json`)).toBe(false);
        rmDist();
      }, 200_000);
    });

    100_000;
  });

  describe('incremental building', () => {
    const app = uniq('demo');
    const lib = uniq('my-lib');
    beforeAll(() => {
      proj = newProject({
        name: uniq('vite-incr-build'),
        packages: ['@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${app} --bundler=vite --no-interactive  --directory=${app}`
      );

      // only this project will be directly used from dist
      runCLI(
        `generate @nx/react:lib ${lib}-buildable --unitTestRunner=none --bundler=vite --importPath="@acme/buildable" --no-interactive --directory=${lib}-buildable`
      );

      runCLI(
        `generate @nx/react:lib ${lib} --unitTestRunner=none --bundler=none --importPath="@acme/non-buildable" --no-interactive --directory=${lib}`
      );

      // because the default js lib builds as cjs it cannot be loaded from dist
      // so the paths plugin should always resolve to the libs source
      runCLI(
        `generate @nx/js:lib ${lib}-js --bundler=tsc --importPath="@acme/js-lib" --no-interactive  --directory=${lib}-js`
      );
      const buildableLibCmp = names(`${lib}-buildable`).className;
      const nonBuildableLibCmp = names(lib).className;
      const buildableJsLibFn = names(`${lib}-js`).propertyName;

      updateFile(`${app}/src/app/app.tsx`, () => {
        return `
import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import { ${buildableLibCmp} } from '@acme/buildable';
import { ${buildableJsLibFn} } from '@acme/js-lib';
import { ${nonBuildableLibCmp} } from '@acme/non-buildable';

export function App() {
  return (
     <div>
       <${buildableLibCmp} />
       <${nonBuildableLibCmp} />
       <p>{${buildableJsLibFn}()}</p>
       <NxWelcome title='${app}' />
      </div>
  );
}
export default App;
`;
      });
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should build app from libs source', () => {
      const results = runCLI(`build ${app} --buildLibsFromSource=true`);
      expect(results).toContain('Successfully ran target build for project');
      // this should be more modules than build from dist
      expect(results).toContain('40 modules transformed');
    });

    it('should build app from libs dist', () => {
      const results = runCLI(`build ${app} --buildLibsFromSource=false`);
      expect(results).toContain('Successfully ran target build for project');
      // this should be less modules than building from source
      expect(results).toContain('38 modules transformed');
    });

    it('should build app from libs without package.json in lib', () => {
      removeFile(`${lib}-buildable/package.json`);

      const buildFromSourceResults = runCLI(
        `build ${app} --buildLibsFromSource=true`
      );
      expect(buildFromSourceResults).toContain(
        'Successfully ran target build for project'
      );

      const noBuildFromSourceResults = runCLI(
        `build ${app} --buildLibsFromSource=false`
      );
      expect(noBuildFromSourceResults).toContain(
        'Successfully ran target build for project'
      );
    });
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

    describe('using custom project configuration', () => {
      const lib = uniq('my-custom-lib');
      beforeEach(() => {
        proj = newProject({ name: uniq('vite-proj'), packages: ['@nx/react'] });
      });

      it('should be able to run tests', async () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        expect(exists(tmpProjPath(`libs/${lib}/vite.config.ts`))).toBeTruthy();

        const result = await runCLIAsync(`test ${lib}`);
        expect(result.combinedOutput).toContain(
          `Successfully ran target test for project ${lib}`
        );

        const nestedResults = await runCLIAsync(`test ${lib} --skip-nx-cache`, {
          cwd: `${tmpProjPath()}/libs/${lib}`,
        });
        expect(nestedResults.combinedOutput).toContain(
          `Successfully ran target test for project ${lib}`
        );
      }, 100_000);

      it('should collect coverage', () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        updateFile(`libs/${lib}/vite.config.ts`, () => {
          return `/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        
        export default defineConfig({
          root: __dirname,
          cacheDir: '../../node_modules/.vite/libs/${lib}',
          plugins: [react(), nxViteTsPaths()],
          test: {
            globals: true,
            cache: {
              dir: '../../node_modules/.vitest',
            },
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
              reportsDirectory: '../../coverage/libs/${lib}',
              provider: 'v8',
              enabled: true,
              thresholds: {
                lines: 100,
                statements: 100,
                functions: 100,
                branches: 1000,
              }
            },
          },
        });
        `;
        });

        const coverageDir = `${tmpProjPath()}/coverage/libs/${lib}`;

        const results = runCLI(`test ${lib} --coverage`, {
          silenceError: true,
        });
        expect(results).toContain(
          `Running target test for project ${lib} failed`
        );
        expect(results).toContain(`ERROR: Coverage`);
        expect(directoryExists(coverageDir)).toBeTruthy();
      }, 100_000);

      it('should not delete the project directory when coverage is enabled', async () => {
        // when coverage is enabled in the vite.config.ts but reportsDirectory is removed
        // from the @nx/vite:test executor options, vite will delete the project root directory
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest`
        );
        updateFile(`libs/${lib}/vite.config.ts`, () => {
          return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';


export default defineConfig({
  server: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [
    react(),
    nxViteTsPaths()
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
        updateJson(join('libs', lib, 'project.json'), (config) => {
          delete config.targets.test.options.reportsDirectory;
          return config;
        });

        const projectRoot = `${tmpProjPath()}/libs/${lib}`;

        const results = runCLI(`test ${lib}`, {
          env: {
            CI: 'true', // prevent vitest from watching for file changes and making the process hang
          },
        });

        expect(directoryExists(projectRoot)).toBeTruthy();
        expect(results).toContain(
          `Successfully ran target test for project ${lib}`
        );
        expect(results).toContain(`JUNIT report written`);
      }, 100_000);

      it('should be able to run tests with inSourceTests set to true', async () => {
        runCLI(
          `generate @nx/react:lib ${lib} --directory=libs/${lib} --unitTestRunner=vitest --inSourceTests`
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

  describe('ESM-only apps', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/react'],
      });
    });

    it('should support ESM-only plugins in vite.config.ts for root apps (#NXP-168)', () => {
      // ESM-only plugin to test with
      updateFile(
        'foo/package.json',
        JSON.stringify({
          name: '@acme/foo',
          type: 'module',
          version: '1.0.0',
          main: 'index.js',
        })
      );
      updateFile(
        'foo/index.js',
        `
        export default function fooPlugin() {
          return {
            name: 'foo-plugin',
            configResolved() {
              console.log('Foo plugin');
            }
          }
        }`
      );
      updateJson('package.json', (json) => {
        json.devDependencies['@acme/foo'] = 'file:./foo';
        return json;
      });
      runCommand(getPackageManagerCommand().install);

      const rootApp = uniq('root');
      runCLI(
        `generate @nx/react:app ${rootApp} --rootProject --bundler=vite --unitTestRunner=none --e2eTestRunner=none --style=css --no-interactive`
      );
      updateJson(`package.json`, (json) => {
        // This allows us to use ESM-only packages in vite.config.ts.
        json.type = 'module';
        return json;
      });
      updateFile(
        `vite.config.ts`,
        `
        import fooPlugin from '@acme/foo';
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        
        export default defineConfig({
          cacheDir: '../../node_modules/.vite/root-app',
          server: {
            port: 4200,
            host: 'localhost',
          },
          plugins: [react(), nxViteTsPaths(), fooPlugin()],
        });`
      );

      runCLI(`build ${rootApp}`);

      checkFilesExist(`dist/${rootApp}/index.html`);
    });
  });
});
