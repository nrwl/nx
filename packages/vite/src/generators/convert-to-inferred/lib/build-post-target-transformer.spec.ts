import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  buildPostTargetTransformer,
  moveBuildLibsFromSourceToViteConfig,
} from './build-post-target-transformer';

describe('buildPostTargetTransformer', () => {
  it('should remove the correct options and move the AST options to the vite config file correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      options: {
        outputPath: 'build/apps/myapp',
        configFile: 'vite.config.ts',
        buildLibsFromSource: true,
        skipTypeCheck: false,
        watch: true,
        generatePackageJson: true,
        includeDevDependenciesInPackageJson: false,
        tsConfig: 'apps/myapp/tsconfig.json',
      },
    };

    tree.write('vite.config.ts', viteConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(targetConfiguration, tree, {
      projectName: 'myapp',
      root: 'apps/myapp',
    });

    // ASSERT
    const configFile = tree.read('vite.config.ts', 'utf-8');
    expect(configFile).toMatchSnapshot();
    expect(target).toMatchInlineSnapshot(`
      {
        "options": {
          "config": "../../vite.config.ts",
          "outDir": "../../build/apps/myapp",
          "watch": true,
        },
      }
    `);
  });

  describe('moveBuildLibsFromSourceToViteConfig', () => {
    it('should add buildLibsFromSource to existing nxViteTsPaths plugin with no existing options', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, true, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: true })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to existing nxViteTsPaths plugin with existing options', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NxViteTsPathsOpts);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, false, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({buildLibsFromSource: false,  debug: true })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to new nxViteTsPaths plugin when the plugin is not added', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NoNxViteTsPaths);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, true, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: true })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to new nxViteTsPaths plugin when the plugins property does not exist', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NoPlugins);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, true, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: true })'
      );
      expect(newContents).toMatchSnapshot();
    });
  });
});

const viteConfigFileV17 = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;
const viteConfigFileV17NoOutDir = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;
const viteConfigFileV17NxViteTsPathsOpts = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react(), nxViteTsPaths({ debug: true })],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;
const viteConfigFileV17NoNxViteTsPaths = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [react()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;
const viteConfigFileV17NoPlugins = `/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/myapp',

  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: '../../dist/apps/myapp',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/myapp',
      provider: 'v8',
    },
  },
});`;
