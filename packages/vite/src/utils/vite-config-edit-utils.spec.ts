import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { tsquery } from '@phenomnomnominal/tsquery';

import { ensureBuildOptionsInViteConfig } from './vite-config-edit-utils';

describe('generator utils', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyV1Workspace();
  });

  describe('ensureBuildOptionsInViteConfig', () => {
    let tree: Tree;

    const buildOption = `
    // Configuration for building your library.
    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      lib: {
        // Could also be a dictionary or array of multiple entry points.
        entry: 'src/index.ts',
        name: 'my-app',
        fileName: 'index',
        // Change this to the formats you want to support.
        // Don't forgot to update your package.json as well.
        formats: ['es', 'cjs']
      },
      rollupOptions: {
        // External packages that should not be bundled into your library.
        external: ["'react', 'react-dom', 'react/jsx-runtime'"]
      }
    },`;
    const buildOptionObject = {
      lib: {
        entry: 'src/index.ts',
        name: 'my-app',
        fileName: 'index',
        formats: ['es', 'cjs'],
      },
      rollupOptions: {
        external: ["'react', 'react-dom', 'react/jsx-runtime'"],
      },
    };
    const dtsPlugin = `dts({
      tsConfigFilePath: join(__dirname, 'tsconfig.lib.json'),
      // Faster builds by skipping tests. Set this to false to enable type checking.
      skipDiagnostics: true,
    }),`;
    const dtsImportLine = `import dts from 'vite-plugin-dts';\nimport { join } from 'path';`;

    const pluginOption = `
    plugins: [
      ${dtsPlugin}
      react(),
      viteTsConfigPaths({
        root: '../../',
      }),
    ],
    `;

    const noBuildOptions = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

    });
    `;

    const someBuildOptions = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

      build: {
        my: 'option',
      }

    });
    `;

    const noContentDefineConfig = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({});
    `;

    const conditionalConfig = `
    import { defineConfig } from 'vite';
    export default defineConfig(({ command, mode, ssrBuild }) => {
      if (command === 'serve') {
        return {
          port: 4200,
          host: 'localhost',
        }
      } else {
        // command === 'build'
        return {
          my: 'option',
        }
      }
    })
    `;

    const configNoDefineConfig = `
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default {
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],
    };
    `;

    beforeEach(() => {
      tree = createTreeWithEmptyV1Workspace();
    });

    it("should add build options if build options don't exist", () => {
      tree.write('apps/my-app/vite.config.ts', noBuildOptions);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
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

    it('should add new build options if some build options already exist', () => {
      tree.write('apps/my-app/vite.config.ts', someBuildOptions);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
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

    it('should add build options if defineConfig is empty', () => {
      tree.write('apps/my-app/vite.config.ts', noContentDefineConfig);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
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

    it('should add build options if it is using conditional config', () => {
      tree.write('apps/my-app/vite.config.ts', conditionalConfig);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
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
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
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

    it('should not do anything if cannot understand syntax of vite config', () => {
      tree.write('apps/my-app/vite.config.ts', `console.log('Unknown syntax')`);
      ensureBuildOptionsInViteConfig(
        tree,
        'apps/my-app/vite.config.ts',
        buildOption,
        buildOptionObject,
        dtsPlugin,
        dtsImportLine,
        pluginOption
      );
      const appFileContent = tree.read('apps/my-app/vite.config.ts', 'utf-8');
      expect(appFileContent).toMatchSnapshot();
    });
  });
});
