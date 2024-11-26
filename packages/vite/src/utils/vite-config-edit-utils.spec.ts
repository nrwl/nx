import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  buildOption,
  buildOptionObject,
  conditionalConfig,
  configNoDefineConfig,
  imports,
  hasEverything,
  noBuildOptions,
  noBuildOptionsHasTestOption,
  noContentDefineConfig,
  plugins,
  someBuildOptions,
  someBuildOptionsSomeTestOption,
  testOption,
  testOptionObject,
} from './test-files/test-vite-configs';
import { ensureViteConfigIsCorrect } from './vite-config-edit-utils';

describe('ensureViteConfigIsCorrect', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it("should add build options if build options don't exist", () => {
    tree.write('apps/my-app/vite.config.ts', noBuildOptions);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
            
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          build: {
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'my-app',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es', 'cjs']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: ['react', 'react-dom', 'react/jsx-runtime']
            }
          },cacheDir: '../../node_modules/.vitest',
            plugins: [react(), nxViteTsPaths(), ],

            test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            },

          });
          "
    `);
  });

  it('should add new build options if some build options already exist', () => {
    tree.write('apps/my-app/vite.config.ts', someBuildOptions);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
            cacheDir: '../../node_modules/.vitest',
            plugins: [react(), nxViteTsPaths(), ],

            test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            },

            build: {
          'my': 'option',
          'lib': {"entry":"src/index.ts","name":"my-app","fileName":"index","formats":["es","cjs"]},
          'rollupOptions': {"external":["react","react-dom","react/jsx-runtime"]},
        }

          });
          "
    `);
  });

  it('should add build and test options if defineConfig is empty', () => {
    tree.write('apps/my-app/vite.config.ts', noContentDefineConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'

          /// <reference types="vitest" />
          import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          plugins: [react(), nxViteTsPaths()],build: {
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'my-app',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es', 'cjs']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: ['react', 'react-dom', 'react/jsx-runtime']
            }
          },test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          },});
          "
    `);
  });

  it('should add build options if it is using conditional config - do nothing for test', () => {
    tree.write('apps/my-app/vite.config.ts', conditionalConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchSnapshot();
  });

  it('should add build options if defineConfig is not used', () => {
    tree.write('apps/my-app/vite.config.ts', configNoDefineConfig);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    const file = tsquery.ast(appFileContent);
    const buildNode = tsquery.query(
      file,
      'PropertyAssignment:has(Identifier[name="build"])'
    );
    expect(buildNode).toBeDefined();
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default {
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          build: {
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'my-app',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es', 'cjs']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: ['react', 'react-dom', 'react/jsx-runtime']
            }
          },test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          },
            plugins: [react(), nxViteTsPaths(), ],
          };
          "
    `);
  });

  it('should not do anything if cannot understand syntax of vite config', () => {
    tree.write('apps/my-app/vite.config.ts', `console.log('Unknown syntax')`);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: false }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchSnapshot();
  });

  it('should not do anything if project has everything setup already', () => {
    tree.write('apps/my-app/vite.config.ts', hasEverything);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: true, test: true, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchInlineSnapshot(`
      "
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
          import dts from 'vite-plugin-dts';
          import { joinPathFragments } from '@nx/devkit';

          export default defineConfig({
            cacheDir: '../../node_modules/.vitest',
            plugins: [dts({ entryRoot: 'src', tsConfigFilePath: joinPathFragments(__dirname, 'tsconfig.lib.json'), skipDiagnostics: true }), react(), nxViteTsPaths(), ],
          
            // Configuration for building your library.
            // See: https://vitejs.dev/guide/build.html#library-mode
            build: {
              lib: {
                // Could also be a dictionary or array of multiple entry points.
                entry: 'src/index.ts',
                name: 'pure-libs-react-vite',
                fileName: 'index',
                // Change this to the formats you want to support.
                // Don't forget to update your package.json as well.
                formats: ['es', 'cjs'],
              },
              rollupOptions: {
                // External packages that should not be bundled into your library.
                external: ['react', 'react-dom', 'react/jsx-runtime'],
              },
            },
          
            test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            },
          });
          "
    `);
  });

  it('should add build option but not update test option if test already setup', () => {
    tree.write('apps/my-app/vite.config.ts', noBuildOptionsHasTestOption);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: true, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
          
            
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          build: {
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'my-app',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es', 'cjs']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: ['react', 'react-dom', 'react/jsx-runtime']
            }
          },cacheDir: '../../node_modules/.vitest',
            plugins: [react(), nxViteTsPaths(), ],

            test: {
              globals: true,
              environment: 'jsdom',
              include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            },

          });
          "
    `);
  });

  it('should update both test and build options - keep existing settings', () => {
    tree.write('apps/my-app/vite.config.ts', someBuildOptionsSomeTestOption);
    ensureViteConfigIsCorrect(
      tree,
      'apps/my-app/vite.config.ts',
      buildOption,
      buildOptionObject,
      imports,
      plugins,
      testOption,
      testOptionObject,
      '',
      { build: false, test: false, serve: true }
    );
    const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
    expect(appFileContent).toMatchInlineSnapshot(`
      "import dts from 'vite-plugin-dts';
      import { joinPathFragments } from '@nx/devkit'
      import { defineConfig } from 'vite';
          import react from '@vitejs/plugin-react';
          import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

          export default defineConfig({
            plugins: [react(), nxViteTsPaths(), ],

            test: {
          'my': 'option',
          'globals': true,
          'environment': "jsdom",
          'include': ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        },

            build: {
          'my': 'option',
          'lib': {"entry":"src/index.ts","name":"my-app","fileName":"index","formats":["es","cjs"]},
          'rollupOptions': {"external":["react","react-dom","react/jsx-runtime"]},
        }

          });
          "
    `);
  });
});
