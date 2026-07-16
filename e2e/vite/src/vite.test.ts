import {
  cleanupProject,
  getPackageManagerCommand,
  getSelectedPackageManager,
  killProcessAndPorts,
  newProject,
  readJson,
  reservePort,
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
        packages: ['@nx/react', '@nx/vue', '@nx/vite', '@nx/vitest'],
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
      const port = await reservePort();

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
        json.compilerOptions.paths['~/*'] = [`./libs/${mylib}/src/*`];
        return json;
      });

      expect(() => runCLI(`test ${mylib}`)).not.toThrow();
    });

    it('should resolve second tsconfig path value with custom build and test targets', () => {
      const myApp = uniq('myapp');
      const myBuildableLib = uniq('mybuildablelib');
      runCLI(
        `generate @nx/react:app ${myApp} --directory=apps/${myApp} --bundler=vite --unitTestRunner=vitest`
      );
      runCLI(
        `generate @nx/react:library ${myBuildableLib} --directory=libs/${myBuildableLib} --bundler=vite --unitTestRunner=vitest --buildable`
      );

      // Note: target names must not collide with the inferred targets or the
      // atomized targets from ciTargetName (e.g. `test-ci`).
      updateJson(`apps/${myApp}/project.json`, (json) => {
        json.targets ??= {};
        json.targets['custom-test'] = {
          command: 'vitest run',
          options: { cwd: `apps/${myApp}` },
        };
        return json;
      });
      updateJson(`libs/${myBuildableLib}/project.json`, (json) => {
        json.targets ??= {};
        json.targets['custom-build'] = {
          command: 'vite build',
          options: { cwd: `libs/${myBuildableLib}` },
        };
        return json;
      });

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
  plugins: [
    react(),
    nxViteTsPaths({
      buildLibsFromSource: false,
      buildTarget: 'custom-build',
      testTarget: 'custom-test',
    }),
  ],
  build: {
    outDir: '../../dist/apps/${myApp}',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/${myApp}',
      provider: 'v8',
    },
  },
});
`
      );

      const exportedLibraryComponent = names(myBuildableLib).className;
      updateFile(
        `apps/${myApp}/src/app/app.spec.tsx`,
        `
        import { render } from '@testing-library/react';
        import { App } from './app';
        import { ${exportedLibraryComponent} } from 'multi-path-lib';
        // Extensionless .tsx subpath is only resolvable through the plugin's
        // own file matching, which must try every mapped path value.
        import { ${exportedLibraryComponent} as FromSubpath } from 'multi-path-lib/lib/${myBuildableLib}';

        describe('App', () => {
          it('should render successfully', () => {
            const { baseElement } = render(<App />);
            expect(baseElement).toBeTruthy();
            expect(${exportedLibraryComponent}).toBeDefined();
            expect(FromSubpath).toBeDefined();
          });
        });
        `
      );

      updateJson('tsconfig.base.json', (json) => {
        json.compilerOptions.paths['multi-path-lib'] = [
          `libs/does-not-exist/src/index.ts`,
          `libs/${myBuildableLib}/src/index.ts`,
        ];
        json.compilerOptions.paths['multi-path-lib/*'] = [
          `libs/does-not-exist/src/*`,
          `libs/${myBuildableLib}/src/*`,
        ];
        return json;
      });

      try {
        expect(() => runCLI(`run ${myApp}:custom-test`)).not.toThrow();
      } finally {
        // Clean up the shared tsconfig so the path alias does not leak into
        // subsequent tests.
        updateJson('tsconfig.base.json', (json) => {
          delete json.compilerOptions.paths['multi-path-lib'];
          delete json.compilerOptions.paths['multi-path-lib/*'];
          return json;
        });
      }
    }, 300_000);

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
        json.compilerOptions.paths['~/*'] = [`./libs/${mylib}/src/*`];
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
        json.compilerOptions.paths['match-lib-deep/*'] = [
          `./libs/${lib1}/src/*`,
        ];
        json.compilerOptions.paths['match-lib-top-level'] = [
          `./libs/${lib2}/src/bar.enum.ts`,
        ];
        json.compilerOptions.paths['match-lib/*'] = [`./libs/${lib3}/src/*`];
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
        json.compilerOptions.paths = {
          '~/*': ['./src/*'],
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
        packages: ['@nx/react', '@nx/vite', '@nx/vitest'],
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
        packages: ['@nx/react', '@nx/vite', '@nx/vitest'],
      });
      runCLI(
        `generate @nx/react:app ${vite7App} --directory=apps/${vite7App} --bundler=vite --unitTestRunner=vitest`
      );

      // Downgrade to Vite 7 and @vitejs/plugin-react v4 (v6 only supports Vite 8)
      const isYarn = getSelectedPackageManager() === 'yarn';
      updateJson('package.json', (json) => {
        json.devDependencies['vite'] = '^7.0.0';
        json.devDependencies['@vitejs/plugin-react'] = '^4.2.0';
        // Yarn classic's linker bombs ("could not find a copy of vite to link
        // in node_modules/vitest/node_modules") when intersecting a
        // top-level `^7.0.0` range with vitest's vite dep+peer combo. Pin
        // vite via `resolutions` so yarn commits to a single version up
        // front and skips the buggy hoisting path.
        if (isYarn) {
          json.resolutions = { ...(json.resolutions ?? {}), vite: '^7.0.0' };
        }
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
        packages: ['@nx/vitest', '@nx/react', '@nx/webpack', '@nx/vite'],
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
      expect(vitePlugin.options.ciTargetName).toEqual('test-ci');
    });

    it('project.json should not contain test target', () => {
      const projectJson = readJson(`${reactVitest}/project.json`);
      expect(projectJson.targets.test).toBeUndefined();
    });

    it('should atomize the ci target identically with and without the vitest runtime', () => {
      const collectAtomized = (details) =>
        Object.keys(details.targets)
          .filter((t) => t.startsWith('test-ci--'))
          .sort()
          .map((t) => ({
            target: t,
            command: details.targets[t].options?.command,
          }));

      // default path: spec files discovered via glob (runtime disabled)
      const globDetails = JSON.parse(
        runCLI(`show project ${reactVitest} --json`)
      );
      const parent = globDetails.targets['test-ci'];
      expect(parent).toBeDefined();
      expect(parent.executor).toEqual('nx:noop');
      expect(parent.metadata.nonAtomizedTarget).toEqual('test');

      const globAtomized = collectAtomized(globDetails);
      expect(globAtomized.length).toBeGreaterThan(0);
      for (const { target, command } of globAtomized) {
        const relativePath = target.slice('test-ci--'.length);
        expect(relativePath).toMatch(/\.spec\.tsx?$/);
        expect(command).toEqual(`vitest run ${relativePath}`);
      }

      // force the vitest runtime to enumerate the specs; atomization must match
      // the glob path exactly so the OOM-avoiding default preserves behavior
      updateJson('nx.json', (json) => {
        const vitest = json.plugins.find((p) => p.plugin === '@nx/vitest');
        vitest.options.discoverTestFiles = 'vitest';
        return json;
      });

      const runtimeDetails = JSON.parse(
        runCLI(`show project ${reactVitest} --json`)
      );
      expect(collectAtomized(runtimeDetails)).toEqual(globAtomized);
    });

    it('should discover atomized specs under the vitest test mode', () => {
      // Restore the glob path (the parity test above forced the runtime).
      updateJson('nx.json', (json) => {
        const vitest = json.plugins.find((p) => p.plugin === '@nx/vitest');
        vitest.options.discoverTestFiles = 'glob';
        return json;
      });

      // A config whose `test.include` branches on the resolved Vite mode.
      // Vitest runs under mode 'test', so the glob path must resolve the same
      // mode; resolving under 'development' would enumerate the wrong spec.
      updateFile(
        `${reactVitest}/vite.config.mts`,
        `import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  test: {
    include:
      mode === 'test'
        ? ['src/**/*.vitest-mode.spec.ts']
        : ['src/**/*.vite-dev-mode.spec.ts'],
  },
}));
`
      );
      updateFile(
        `${reactVitest}/src/sample.vitest-mode.spec.ts`,
        `import { expect, test } from 'vitest';\ntest('mode', () => expect(true).toBe(true));\n`
      );
      updateFile(
        `${reactVitest}/src/sample.vite-dev-mode.spec.ts`,
        `import { expect, test } from 'vitest';\ntest('mode', () => expect(true).toBe(true));\n`
      );

      const details = JSON.parse(runCLI(`show project ${reactVitest} --json`));
      const atomized = Object.keys(details.targets).filter((t) =>
        t.startsWith('test-ci--')
      );

      expect(atomized).toContain('test-ci--src/sample.vitest-mode.spec.ts');
      expect(atomized).not.toContain(
        'test-ci--src/sample.vite-dev-mode.spec.ts'
      );
    });
  });
});
