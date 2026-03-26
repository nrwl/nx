import {
  cleanupProject,
  getPackageManagerCommand,
  killProcessAndPorts,
  newProject,
  readJson,
  runCLI,
  runCommand,
  runCommandUntil,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
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
        `generate @nx/react:app ${myApp} --directory=apps/${myApp} --bundler=vite --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/vue:app ${myVueApp} --directory=apps/${myVueApp} --unitTestRunner=vitest`
      );
    });

    afterAll(() => {
      cleanupProject();
    });

    describe('build and test React app', () => {
      it('should build application', () => {
        expect(() => runCLI(`build ${myApp}`)).not.toThrow();
      }, 200_000);

      it('should test application', () => {
        expect(() => runCLI(`test ${myApp} --watch=false`)).not.toThrow();
      }, 200_000);
    });
    describe('build and test Vue app', () => {
      it('should build application', () => {
        expect(() => runCLI(`build ${myVueApp}`)).not.toThrow();
      }, 200_000);

      it('should test application', () => {
        expect(() => runCLI(`test ${myVueApp} --watch=false`)).not.toThrow();
      }, 200_000);
    });

    describe('should support buildable libraries', () => {
      it('should build the library and application successfully', () => {
        const myApp = uniq('myapp');
        runCLI(
          `generate @nx/react:app ${myApp} --directory=apps/${myApp} --bundler=vite --unitTestRunner=vitest`
        );

        const myBuildableLib = uniq('mybuildablelib');
        runCLI(
          `generate @nx/react:library ${myBuildableLib} --directory=libs/${myBuildableLib} --bundler=vite --unitTestRunner=vitest --buildable`
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
          `apps/${myApp}/vite.config.mts`,
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

        expect(() => runCLI(`build ${myApp}`)).not.toThrow();
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

    it('should support importing .js and .css files in tsconfig path', () => {
      const mylib = uniq('mylib');
      runCLI(
        `generate @nx/react:library libs/${mylib} --bundler=none --unitTestRunner=vitest`
      );
      updateFile(`libs/${mylib}/src/styles.css`, `.foo {}`);
      updateFile(`libs/${mylib}/src/foo.mjs`, `export const foo = 'foo';`);
      updateFile(
        `libs/${mylib}/src/foo.spec.ts`,
        `
          import styles from '~/styles.css?inline';
          import { foo } from '~/foo.mjs';
          test('should work', () => {
            expect(styles).toBeDefined();
            expect(foo).toBeDefined();
          });
        `
      );
      updateJson('tsconfig.base.json', (json) => {
        json.compilerOptions.paths['~/*'] = [`libs/${mylib}/src/*`];
        return json;
      });

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
    });

    it('should support importing files with "." in the name in tsconfig path', () => {
      const mylib = uniq('mylib');
      runCLI(
        `generate @nx/react:library libs/${mylib} --bundler=none --unitTestRunner=vitest`
      );
      updateFile(`libs/${mylib}/src/styles.module.css`, `.foo {}`);
      updateFile(`libs/${mylib}/src/foo.enum.ts`, `export const foo = 'foo';`);
      updateFile(`libs/${mylib}/src/bar.enum.ts`, `export const bar = 'bar';`);
      updateFile(
        `libs/${mylib}/src/foo.spec.ts`,
        `
          import styles from '~/styles.module.css';
          import { foo } from '~/foo.enum.ts';
          import { bar } from '~/bar.enum';
          test('should work', () => {
            expect(styles).toBeDefined();
            expect(foo).toBeDefined();
            expect(bar).toBeDefined();
          });
        `
      );
      updateJson('tsconfig.base.json', (json) => {
        json.compilerOptions.paths['~/*'] = [`libs/${mylib}/src/*`];
        return json;
      });

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
    });

    it('should not partially match a path mapping', () => {
      const lib1 = uniq('lib1');
      const lib2 = uniq('lib2');
      const lib3 = uniq('lib3');
      runCLI(
        `generate @nx/react:library libs/${lib1} --bundler=none --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:library libs/${lib2} --bundler=none --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:library libs/${lib3} --bundler=none --unitTestRunner=vitest`
      );
      updateFile(`libs/${lib1}/src/foo.enum.ts`, `export const foo = 'foo';`);
      updateFile(`libs/${lib2}/src/bar.enum.ts`, `export const bar = 'bar';`);
      updateFile(`libs/${lib3}/src/bam.enum.ts`, `export const bam = 'bam';`);
      updateFile(
        `libs/${lib1}/src/foo.spec.ts`,
        `
          import { foo } from 'match-lib-deep/foo.enum';
          import { bar } from 'match-lib-top-level';
          import { bam } from 'match-lib/bam.enum';
          test('should work', () => {
            expect(foo).toBeDefined();
            expect(bar).toBeDefined();
            expect(bam).toBeDefined();
          });
        `
      );
      updateJson('tsconfig.base.json', (json) => {
        json.compilerOptions.paths['match-lib-deep/*'] = [`libs/${lib1}/src/*`];
        json.compilerOptions.paths['match-lib-top-level'] = [
          `libs/${lib2}/src/bar.enum.ts`,
        ];
        json.compilerOptions.paths['match-lib/*'] = [`libs/${lib3}/src/*`];
        return json;
      });

      expect(() => runCLI(`test ${lib1}`)).not.toThrow();
    });

    it('should support local path aliases in project tsconfig.app.json', () => {
      const myLocalApp = uniq('myapp');
      runCLI(
        `generate @nx/react:app ${myLocalApp} --directory=apps/${myLocalApp} --bundler=vite --unitTestRunner=vitest`
      );

      // Add a local path alias in the project's tsconfig.app.json
      updateJson(`apps/${myLocalApp}/tsconfig.app.json`, (json) => {
        json.compilerOptions = json.compilerOptions || {};
        json.compilerOptions.baseUrl = '.';
        json.compilerOptions.paths = {
          '~/*': ['src/*'],
        };
        return json;
      });

      // Update the app to use the local path alias
      updateFile(
        `apps/${myLocalApp}/src/app/app.tsx`,
        `import NxWelcome from '~/app/nx-welcome';

        export function App() {
          return (
            <div>
              <NxWelcome title="${myLocalApp}" />
            </div>
          );
        }

        export default App;`
      );

      // Ensure build works with local path aliases
      expect(() => runCLI(`build ${myLocalApp}`)).not.toThrow();
    });
  });

  describe('with Vite 8 and React (default)', () => {
    const vite8App = uniq('vite8app');

    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${vite8App} --directory=apps/${vite8App} --bundler=vite --unitTestRunner=vitest`
      );
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should build React application with Vite 8', () => {
      expect(() => runCLI(`build ${vite8App}`)).not.toThrow();
    }, 200_000);

    it('should test React application with Vite 8', () => {
      expect(() => runCLI(`test ${vite8App} --watch=false`)).not.toThrow();
    }, 200_000);
  });

  describe('with Vite 7 (backward compatibility)', () => {
    const vite7App = uniq('vite7app');

    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${vite7App} --directory=apps/${vite7App} --bundler=vite --unitTestRunner=vitest`
      );

      // Downgrade to Vite 7 and @vitejs/plugin-react v4 (v6 only supports Vite 8)
      updateJson('package.json', (json) => {
        json.devDependencies['vite'] = '^7.0.0';
        json.devDependencies['@vitejs/plugin-react'] = '^4.2.0';
        return json;
      });
      runCommand(getPackageManagerCommand().install);
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should build React application with Vite 7', () => {
      expect(() => runCLI(`build ${vite7App}`)).not.toThrow();
    }, 200_000);

    it('should test React application with Vite 7', () => {
      expect(() => runCLI(`test ${vite7App} --watch=false`)).not.toThrow();
    }, 200_000);
  });

  // TODO(Colum): Move this to a vitest specific e2e project when one is created
  describe('react with vitest only', () => {
    const reactVitest = uniq('reactVitest');

    beforeAll(() => {
      proj = newProject({
        packages: ['@nx/vitest', '@nx/react'],
      });
      runCLI(
        `generate @nx/react:app ${reactVitest} --bundler=webpack --unitTestRunner=vitest --e2eTestRunner=none`
      );
    });

    afterAll(() => {
      cleanupProject();
    });

    it('should contain targets test', () => {
      const nxJson = readJson('nx.json');

      const vitePlugin = nxJson.plugins.find((p) => p.plugin === '@nx/vitest');
      expect(vitePlugin).toBeDefined();
      expect(vitePlugin.options.testTargetName).toEqual('test');
    });

    it('project.json should not contain test target', () => {
      const projectJson = readJson(`${reactVitest}/project.json`);
      expect(projectJson.targets.test).toBeUndefined();
    });
  });
});
