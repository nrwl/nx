import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { extractRollupConfigFromExecutorOptions } from './extract-rollup-config-from-executor-options';

describe('extract-rollup-config-from-executor-options', () => {
  it('should extract the options correctly', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/myapp/rollup.config.js`,
      `export default (config) => {return config;}`
    );
    // ACT
    const defaultValues = extractRollupConfigFromExecutorOptions(
      tree,
      {
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.json',
        project: '',
        main: 'src/lib/index.ts',
        rollupConfig: 'apps/myapp/rollup.config.js',
        watch: true,
        format: ['esm', 'cjs'],
      },
      {},
      'apps/myapp'
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/rollup.config.js', 'utf-8');
    expect(configFile).toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');

      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const options = {
      "outputPath": "../../dist/apps/myapp",
      "tsConfig": "./tsconfig.json",
      "project": "",
      "main": "../../src/lib/index.ts",
      "format": [
      "esm",
      "cjs"
      ]
      };

      let config = withNx(options, {
      // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
      // e.g.
      // output: { sourcemap: true },
      });

      config = require('./rollup.migrated.config.js')(config, options);

      module.exports = config;"
    `);
    expect(tree.exists('apps/myapp/rollup.migrated.config.js')).toBeTruthy();
    expect(defaultValues).toMatchInlineSnapshot(`
      {
        "format": [
          "esm",
          "cjs",
        ],
        "main": "../../src/lib/index.ts",
        "outputPath": "../../dist/apps/myapp",
        "project": "",
        "tsConfig": "./tsconfig.json",
      }
    `);
  });

  it('should extract configurations that do not defined a rollupConfig into the rollup.config.js file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/myapp/rollup.config.js`,
      `export default (config) => {return config;}`
    );
    tree.write(
      `apps/myapp/rollup.dev.config.js`,
      `export default (config) => {return config;}`
    );
    // ACT
    const defaultValues = extractRollupConfigFromExecutorOptions(
      tree,
      {
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.json',
        project: '',
        main: 'src/lib/index.ts',
        rollupConfig: 'apps/myapp/rollup.config.js',
        watch: true,
        format: ['esm', 'cjs'],
      },
      {
        dev: {
          format: ['esm'],
        },
      },
      'apps/myapp'
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/rollup.config.js', 'utf-8');
    expect(configFile).toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');

      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const configValues =  {
      "default": {
      "outputPath": "../../dist/apps/myapp",
      "tsConfig": "./tsconfig.json",
      "project": "",
      "main": "../../src/lib/index.ts",
      "format": [
      "esm",
      "cjs"
      ]
      },
      "dev": {
      "format": [
      "esm"
      ]
      }
      };

      // Determine the correct configValue to use based on the configuration
      const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';

      const options = {
      ...configValues.default,
      ...configValues[nxConfiguration],
      };

      let config = withNx(options, {
      // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
      // e.g.
      // output: { sourcemap: true },
      });

      config = require('./rollup.migrated.config.js')(config, options);

      module.exports = config;"
    `);
    expect(tree.exists('apps/myapp/rollup.migrated.config.js')).toBeTruthy();
    expect(defaultValues).toMatchInlineSnapshot(`
      {
        "format": [
          "esm",
          "cjs",
        ],
        "main": "../../src/lib/index.ts",
        "outputPath": "../../dist/apps/myapp",
        "project": "",
        "tsConfig": "./tsconfig.json",
      }
    `);
  });

  it('should extract configurations that do defined a rollupConfig into their own rollup.{configName}.config.js file', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `apps/myapp/rollup.config.js`,
      `export default (config) => {return config;}`
    );
    tree.write(
      `apps/myapp/rollup.dev.config.js`,
      `export default (config) => {return config;}`
    );
    // ACT
    const defaultValues = extractRollupConfigFromExecutorOptions(
      tree,
      {
        outputPath: 'dist/apps/myapp',
        tsConfig: 'apps/myapp/tsconfig.json',
        project: '',
        main: 'src/lib/index.ts',
        rollupConfig: 'apps/myapp/rollup.config.js',
        watch: true,
        format: ['esm', 'cjs'],
      },
      {
        dev: {
          rollupConfig: 'rollup.dev.config.js',
          format: ['esm'],
        },
      },
      'apps/myapp'
    );

    // ASSERT
    const configFile = tree.read('apps/myapp/rollup.dev.config.js', 'utf-8');
    expect(configFile).toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');

      // These options were migrated by @nx/rollup:convert-to-inferred from project.json
      const configValues =  {
      "outputPath": "../../dist/apps/myapp",
      "tsConfig": "./tsconfig.json",
      "project": "",
      "main": "../../src/lib/index.ts",
      "format": [
      "esm"
      ]
      };

      // Determine the correct configValue to use based on the configuration
      const nxConfiguration = process.env.NX_TASK_TARGET_CONFIGURATION ?? 'default';

      const options = {
      ...configValues.default,
      ...configValues[nxConfiguration],
      };

      let config = withNx(options, {
      // Provide additional rollup configuration here. See: https://rollupjs.org/configuration-options
      // e.g.
      // output: { sourcemap: true },
      });

      config = require('./rollup.dev.migrated.config.js')(config, options);

      module.exports = config;"
    `);
    expect(
      tree.exists('apps/myapp/rollup.dev.migrated.config.js')
    ).toBeTruthy();
    expect(defaultValues).toMatchInlineSnapshot(`
      {
        "format": [
          "esm",
          "cjs",
        ],
        "main": "../../src/lib/index.ts",
        "outputPath": "../../dist/apps/myapp",
        "project": "",
        "tsConfig": "./tsconfig.json",
      }
    `);
  });
});
