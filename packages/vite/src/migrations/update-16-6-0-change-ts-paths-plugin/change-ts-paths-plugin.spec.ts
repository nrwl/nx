import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';

import changeTsPathsPlugin from './change-ts-paths-plugin';

describe('change-vite-ts-paths-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update viteTsConfigPaths to nxViteTsPaths plugin', () => {
    addProject(tree, 'demo');

    changeTsPathsPlugin(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "
      /// <reference types="vitest" />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig({
        cacheDir: '../../node_modules/.vite/demo',
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
          nxViteTsPaths()
        ],

        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [
        //    viteTsConfigPaths({
        //      root: '../../',
        //    }),
        //  ],
        // },

        test: {
          globals: true,
          cache: {
            dir: '../../node_modules/.vitest',
          },
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        },
      });

      "
    `);
  });

  it('should not change anything if viteTsConfigPaths is not used', () => {
    addProject(tree, 'demo');
    tree.delete('apps/demo/vite.config.ts');

    expect(() => changeTsPathsPlugin(tree)).not.toThrow();
    expect(tree.exists('apps/demo/vite.config.ts')).toBeFalsy();
  });
});

function addProject(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/apps/${name}`,
          buildLibsFromSource: false,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });

  tree.write(
    `apps/${name}/vite.config.ts`,
    `
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/${name}',
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
    viteTsConfigPaths({ 
      root: '../../'
    })
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [
  //    viteTsConfigPaths({
  //      root: '../../',
  //    }),
  //  ],
  // },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});

`
  );
}
