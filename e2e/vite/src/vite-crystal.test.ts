import {
  cleanupProject,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommandUntil,
  uniq,
  updateFile,
} from '@nx/e2e/utils';
import { ChildProcess } from 'child_process';
import { names } from '@nx/devkit';

const myApp = uniq('my-app');
const myVueApp = uniq('my-vue-app');

describe('@nx/vite/plugin', () => {
  let proj: string;
  let originalEnv: string;
  beforeAll(() => {
    originalEnv = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'true';
  });

  afterAll(() => {
    process.env.NX_ADD_PLUGINS = originalEnv;
    cleanupProject();
  });

  describe('with react', () => {
    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/react', '@nx/vue'],
      });
      runCLI(
        `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
      );
      runCLI(`generate @nx/vue:app ${myVueApp} --unitTestRunner=vitest`);
    });

    afterAll(() => {
      cleanupProject();
    });

    describe('build and test React app', () => {
      it('should build application', () => {
        const result = runCLI(`build ${myApp}`);
        expect(result).toContain('Successfully ran target build');
      }, 200_000);

      it('should test application', () => {
        const result = runCLI(`test ${myApp} --watch=false`);
        expect(result).toContain('Successfully ran target test');
      }, 200_000);
    });
    describe('build and test Vue app', () => {
      it('should build application', () => {
        const result = runCLI(`build ${myVueApp}`);
        expect(result).toContain('Successfully ran target build');
      }, 200_000);

      it('should test application', () => {
        const result = runCLI(`test ${myVueApp} --watch=false`);
        expect(result).toContain('Successfully ran target test');
      }, 200_000);
    });

    describe('should support buildable libraries', () => {
      it('should build the library and application successfully', () => {
        const myApp = uniq('myapp');
        runCLI(
          `generate @nx/react:app ${myApp} --bundler=vite --unitTestRunner=vitest`
        );

        const myBuildableLib = uniq('mybuildablelib');
        runCLI(
          `generate @nx/react:library ${myBuildableLib} --bundler=vite --unitTestRunner=vitest --buildable`
        );

        const exportedLibraryComponent = names(myBuildableLib).className;

        updateFile(
          `apps/${myApp}/src/app/App.tsx`,
          `import NxWelcome from './nx-welcome';
          import { ${exportedLibraryComponent} } from '@proj/${myBuildableLib}';
          export function App() {
            return (
              <div>
                <${exportedLibraryComponent} />
                <NxWelcome title="viteib" />
              </div>
            );
          }
          export default App;`
        );

        updateFile(
          `apps/${myApp}/vite.config.ts`,
          `/// <reference types='vitest' />
          import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
            root: __dirname,
            cacheDir: '../../node_modules/.vite/${myApp}',
          
            server: {
              port: 4200,
              host: 'localhost',
            },
          
            preview: {
              port: 4300,
              host: 'localhost',
            },
          
            plugins: [react(), nxViteTsPaths({buildLibsFromSource: false})],
          
            build: {
              outDir: '../../dist/${myApp}',
              emptyOutDir: true,
              reportCompressedSize: true,
              commonjsOptions: {
                transformMixedEsModules: true,
              },
            },
          });`
        );

        const result = runCLI(`build ${myApp}`);
        expect(result).toContain(
          `Running target build for project ${myApp} and 1 task it depends on`
        );
        expect(result).toContain(
          `Successfully ran target build for project ${myApp} and 1 task it depends on`
        );
      });
    });

    it('should run serve-static', async () => {
      let process: ChildProcess;
      const port = 8081;

      try {
        process = await runCommandUntil(
          `serve-static ${myApp} --port=${port}`,
          (output) => {
            return output.includes(`http://localhost:${port}`);
          }
        );
      } catch (err) {
        console.error(err);
      }

      // port and process cleanup
      if (process && process.pid) {
        await killProcessAndPorts(process.pid, port);
      }
    });
  });

  describe('react with vitest only', () => {
    const reactVitest = uniq('reactVitest');

    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/vite', '@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${reactVitest} --bundler=webpack --unitTestRunner=vitest --e2eTestRunner=none --projectNameAndRootFormat=as-provided`
      );
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should contain targets build, test and lint', () => {
      const nxJson = readJson('nx.json');

      const vitePlugin = nxJson.plugins.find(
        (p) => p.plugin === '@nx/vite/plugin'
      );
      expect(vitePlugin).toBeDefined();
      expect(vitePlugin.options.buildTargetName).toEqual('build');
      expect(vitePlugin.options.testTargetName).toEqual('test');
    });

    it('project.json should not contain test target', () => {
      const projectJson = readJson(`${reactVitest}/project.json`);
      expect(projectJson.targets.test).toBeUndefined();
    });
  });
});
