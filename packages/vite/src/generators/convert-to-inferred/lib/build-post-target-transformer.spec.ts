import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  buildPostTargetTransformer,
  moveBuildLibsFromSourceToViteConfig,
} from './build-post-target-transformer';

describe('buildPostTargetTransformer', () => {
  it('should remove the correct options and move the AST options to the vite config file correctly and remove outputs when they match inferred', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'build/apps/myapp',
        configFile: 'apps/myapp/vite.config.ts',
        buildLibsFromSource: true,
        skipTypeCheck: false,
        watch: true,
        generatePackageJson: true,
        includeDevDependenciesInPackageJson: false,
        tsConfig: 'apps/myapp/tsconfig.json',
      },
    };

    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outDir}'],
    };

    tree.write('apps/myapp/vite.config.ts', viteConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(
      targetConfiguration,
      tree,
      {
        projectName: 'myapp',
        root: 'apps/myapp',
      },
      inferredTargetConfiguration
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/vite.config.ts', 'utf-8');
    expect(configFile).toMatchSnapshot();
    expect(target).toMatchInlineSnapshot(`
      {
        "options": {
          "config": "./vite.config.ts",
          "outDir": "../../build/apps/myapp",
          "watch": true,
        },
      }
    `);
  });

  it('should move the AST options to each vite config file correctly for configurations', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      outputs: ['{options.outputPath}'],
      options: {
        outputPath: 'build/apps/myapp',
        configFile: 'apps/myapp/vite.config.ts',
        buildLibsFromSource: true,
        skipTypeCheck: false,
        watch: true,
        generatePackageJson: true,
        includeDevDependenciesInPackageJson: false,
        tsConfig: 'apps/myapp/tsconfig.json',
      },
      configurations: {
        dev: {
          configFile: 'apps/myapp/vite.dev.config.ts',
        },
      },
    };

    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outDir}'],
    };

    tree.write('apps/myapp/vite.config.ts', viteConfigFileV17);
    tree.write('apps/myapp/vite.dev.config.ts', viteConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(
      targetConfiguration,
      tree,
      {
        projectName: 'myapp',
        root: 'apps/myapp',
      },
      inferredTargetConfiguration
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/vite.config.ts', 'utf-8');
    expect(configFile).toMatchSnapshot();
    const devConfigFile = tree.read('apps/myapp/vite.dev.config.ts', 'utf-8');
    expect(devConfigFile).toMatchSnapshot();
    expect(target).toMatchInlineSnapshot(`
      {
        "configurations": {
          "dev": {
            "config": "./vite.dev.config.ts",
          },
        },
        "options": {
          "config": "./vite.config.ts",
          "outDir": "../../build/apps/myapp",
          "watch": true,
        },
      }
    `);
  });

  it('should add inferred outputs when a custom output exists', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    const targetConfiguration = {
      outputs: ['{options.outputPath}', '{workspaceRoot}/my/custom/path'],
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

    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outDir}'],
    };

    tree.write('vite.config.ts', viteConfigFileV17);

    // ACT
    const target = buildPostTargetTransformer(
      targetConfiguration,
      tree,
      {
        projectName: 'myapp',
        root: 'apps/myapp',
      },
      inferredTargetConfiguration
    );

    // ASSERT
    expect(target).toMatchInlineSnapshot(`
      {
        "options": {
          "config": "../../vite.config.ts",
          "outDir": "../../build/apps/myapp",
          "watch": true,
        },
        "outputs": [
          "{projectRoot}/{options.outDir}",
          "{workspaceRoot}/my/custom/path",
        ],
      }
    `);
  });

  describe('moveBuildLibsFromSourceToViteConfig', () => {
    it('should add buildLibsFromSource to existing nxViteTsPaths plugin with no existing options', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: options.buildLibsFromSource })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to existing nxViteTsPaths plugin with existing options', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NxViteTsPathsOpts);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({buildLibsFromSource: options.buildLibsFromSource,  debug: true })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to new nxViteTsPaths plugin when the plugin is not added', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NoNxViteTsPaths);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: options.buildLibsFromSource })'
      );
      expect(newContents).toMatchSnapshot();
    });

    it('should add buildLibsFromSource to new nxViteTsPaths plugin when the plugins property does not exist', () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      tree.write('vite.config.ts', viteConfigFileV17NoPlugins);

      // ACT
      moveBuildLibsFromSourceToViteConfig(tree, 'vite.config.ts');

      // ASSERT
      const newContents = tree.read('vite.config.ts', 'utf-8');
      expect(newContents).toContain(
        'nxViteTsPaths({ buildLibsFromSource: options.buildLibsFromSource })'
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
