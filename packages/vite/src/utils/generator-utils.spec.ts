import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  findExistingJsBuildTargetInProject,
  getViteConfigPathForProject,
  createOrEditViteConfig,
} from './generator-utils';
import {
  mockReactAppGenerator,
  mockViteReactAppGenerator,
  mockAngularAppGenerator,
} from './test-utils';

describe('generator utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('getViteConfigPathForProject', () => {
    beforeEach(() => {
      mockViteReactAppGenerator(tree);
    });
    it('should return correct path for vite.config file if no configFile is set', () => {
      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.config.ts'
      );
    });

    it('should return correct path for vite.config file if custom configFile is set', () => {
      const projectConfig = readProjectConfiguration(
        tree,
        'my-test-react-vite-app'
      );
      updateProjectConfiguration(tree, 'my-test-react-vite-app', {
        ...projectConfig,
        targets: {
          ...projectConfig.targets,
          build: {
            ...projectConfig.targets.build,
            options: {
              ...projectConfig.targets.build.options,
              configFile: 'apps/my-test-react-vite-app/vite.config.custom.ts',
            },
          },
        },
      });

      tree.write(`apps/my-test-react-vite-app/vite.config.custom.ts`, '');

      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.config.custom.ts'
      );
    });

    it('should return correct path for vite.config file given a target name', () => {
      const projectConfig = readProjectConfiguration(
        tree,
        'my-test-react-vite-app'
      );
      updateProjectConfiguration(tree, 'my-test-react-vite-app', {
        ...projectConfig,
        targets: {
          ...projectConfig.targets,
          'other-build': {
            ...projectConfig.targets.build,
            options: {
              ...projectConfig.targets.build.options,
              configFile: 'apps/my-test-react-vite-app/vite.other.custom.ts',
            },
          },
        },
      });

      tree.write(`apps/my-test-react-vite-app/vite.other.custom.ts`, '');

      const viteConfigPath = getViteConfigPathForProject(
        tree,
        'my-test-react-vite-app',
        'other-build'
      );
      expect(viteConfigPath).toEqual(
        'apps/my-test-react-vite-app/vite.other.custom.ts'
      );
    });
  });

  describe('findExistingJsBuildTargetInProject', () => {
    it('should return no targets', () => {
      mockReactAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-react-app');

      const existingTargets = findExistingJsBuildTargetInProject(targets);
      expect(existingTargets).toMatchObject({});
    });

    it('should return the correct - undefined - targets for Angular apps', () => {
      mockAngularAppGenerator(tree);
      const { targets } = readProjectConfiguration(tree, 'my-test-angular-app');
      const existingTargets = findExistingJsBuildTargetInProject(targets);
      expect(existingTargets).toMatchObject({
        unsupported: 'build',
      });
    });
  });

  describe('createOrEditViteConfig', () => {
    it('should generate formatted config', () => {
      addProjectConfiguration(tree, 'myproj', {
        name: 'myproj',
        root: 'myproj',
      });
      createOrEditViteConfig(
        tree,
        {
          project: 'myproj',
          inSourceTests: true,
          includeVitest: true,
          includeLib: true,
        },
        false
      );

      expect(tree.read('myproj/vite.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import dts from 'vite-plugin-dts';
        import * as path from 'path';
        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

        export default defineConfig({
          root: __dirname,
          cacheDir: '../node_modules/.vite/myproj',
          plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']), dts({ entryRoot: 'src', tsconfigPath: path.join(__dirname, 'tsconfig.lib.json') })],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [ nxViteTsPaths() ],
          // },
          // Configuration for building your library.
          // See: https://vitejs.dev/guide/build.html#library-mode
          build: {
            outDir: '../dist/myproj',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
            lib: {
              // Could also be a dictionary or array of multiple entry points.
              entry: 'src/index.ts',
              name: 'myproj',
              fileName: 'index',
              // Change this to the formats you want to support.
              // Don't forget to update your package.json as well.
              formats: ['es', 'cjs']
            },
            rollupOptions: {
              // External packages that should not be bundled into your library.
              external: []
            },
          },
          define: {
            'import.meta.vitest': undefined
          },
          test: {
            watch: false,
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
              reportsDirectory: '../coverage/myproj',
              provider: 'v8',
            }
          },
        });
        "
      `);
    });

    it('should generate formatted config without library and in-source tests', () => {
      addProjectConfiguration(tree, 'myproj', {
        name: 'myproj',
        root: 'myproj',
      });
      createOrEditViteConfig(
        tree,
        {
          project: 'myproj',
          inSourceTests: false,
          includeVitest: false,
          includeLib: false,
        },
        false
      );

      expect(tree.read('myproj/vite.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';

        import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
        import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

        export default defineConfig({
          root: __dirname,
          cacheDir: '../node_modules/.vite/myproj',
          server:{
            port: 4200,
            host: 'localhost',
          },
          preview:{
            port: 4300,
            host: 'localhost',
          },
          plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [ nxViteTsPaths() ],
          // },
          build: {
            outDir: '../dist/myproj',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
          },
        });
        "
      `);
    });
  });
});
