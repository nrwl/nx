import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { buildPostTargetTransformer } from './build-post-target-transformer';

describe('buildPostTargetTransformer', () => {
  it('should migrate build options and remove outputs that match inferred', () => {
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
    expect(configFile).toBe(viteConfigFileV17);
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

  it('should migrate configuration options without rewriting Vite configs', () => {
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
    expect(configFile).toBe(viteConfigFileV17);
    const devConfigFile = tree.read('apps/myapp/vite.dev.config.ts', 'utf-8');
    expect(devConfigFile).toBe(viteConfigFileV17);
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

  it('should leave the Vite config unchanged when rerun', () => {
    const tree = createTreeWithEmptyWorkspace();
    const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
}));
`;
    tree.write('libs/ui/vite.config.mts', viteConfig);
    const createTarget = () => ({
      outputs: ['{options.outputPath}'],
      options: { outputPath: 'dist/libs/ui' },
      configurations: {
        development: { mode: 'development' },
        production: { mode: 'production' },
      },
    });
    const inferredTargetConfiguration = {
      outputs: ['{projectRoot}/{options.outDir}'],
    };
    const projectDetails = { projectName: 'ui', root: 'libs/ui' };

    // A package.json script with the same name keeps the target, so a rerun
    // transforms it again.
    buildPostTargetTransformer(
      createTarget(),
      tree,
      projectDetails,
      inferredTargetConfiguration
    );
    buildPostTargetTransformer(
      createTarget(),
      tree,
      projectDetails,
      inferredTargetConfiguration
    );

    expect(tree.read('libs/ui/vite.config.mts', 'utf-8')).toBe(viteConfig);
  });

  it('should preserve user configValues declarations', () => {
    const tree = createTreeWithEmptyWorkspace();
    const viteConfig = `import { defineConfig } from 'vite';

function getDefines() {
  const configValues = { DEBUG: false };
  return configValues;
}

export default defineConfig(() => ({
  root: import.meta.dirname,
  define: getDefines(),
}));
`;
    tree.write('libs/ui/vite.config.mts', viteConfig);

    buildPostTargetTransformer(
      {
        options: { outputPath: 'dist/libs/ui' },
        configurations: { production: { mode: 'production' } },
      },
      tree,
      { projectName: 'ui', root: 'libs/ui' },
      { outputs: ['{projectRoot}/{options.outDir}'] }
    );

    expect(tree.read('libs/ui/vite.config.mts', 'utf-8')).toBe(viteConfig);
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
