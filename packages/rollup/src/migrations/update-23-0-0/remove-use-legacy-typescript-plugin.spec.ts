import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readNxJson,
  updateNxJson,
  addProjectConfiguration,
} from '@nx/devkit';
import migration from './remove-use-legacy-typescript-plugin';

describe('remove-use-legacy-typescript-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove useLegacyTypescriptPlugin from options', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {
            outputPath: 'dist/libs/lib1',
            main: 'libs/lib1/src/index.ts',
            tsConfig: 'libs/lib1/tsconfig.lib.json',
            useLegacyTypescriptPlugin: true,
          },
        },
      },
    });

    await migration(tree);

    expect(readProjectConfiguration(tree, 'lib1')).toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "lib1",
        "root": "libs/lib1",
        "targets": {
          "build": {
            "executor": "@nx/rollup:rollup",
            "options": {
              "main": "libs/lib1/src/index.ts",
              "outputPath": "dist/libs/lib1",
              "tsConfig": "libs/lib1/tsconfig.lib.json",
            },
          },
        },
      }
    `);
  });

  it('should remove useLegacyTypescriptPlugin from configurations', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {
            outputPath: 'dist/libs/lib1',
            main: 'libs/lib1/src/index.ts',
            tsConfig: 'libs/lib1/tsconfig.lib.json',
          },
          configurations: {
            production: {
              useLegacyTypescriptPlugin: true,
              sourceMap: false,
            },
          },
        },
      },
    });

    await migration(tree);

    expect(readProjectConfiguration(tree, 'lib1').targets.build)
      .toMatchInlineSnapshot(`
      {
        "configurations": {
          "production": {
            "sourceMap": false,
          },
        },
        "executor": "@nx/rollup:rollup",
        "options": {
          "main": "libs/lib1/src/index.ts",
          "outputPath": "dist/libs/lib1",
          "tsConfig": "libs/lib1/tsconfig.lib.json",
        },
      }
    `);
  });

  it('should handle the @nrwl/rollup:rollup executor', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@nrwl/rollup:rollup',
          options: {
            outputPath: 'dist/libs/lib1',
            main: 'libs/lib1/src/index.ts',
            tsConfig: 'libs/lib1/tsconfig.lib.json',
            useLegacyTypescriptPlugin: false,
          },
        },
      },
    });

    await migration(tree);

    expect(readProjectConfiguration(tree, 'lib1').targets.build.options)
      .toMatchInlineSnapshot(`
      {
        "main": "libs/lib1/src/index.ts",
        "outputPath": "dist/libs/lib1",
        "tsConfig": "libs/lib1/tsconfig.lib.json",
      }
    `);
  });

  it('should not modify projects with other executors', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@nx/vite:build',
          options: {
            useLegacyTypescriptPlugin: true,
          },
        },
      },
    });

    await migration(tree);

    expect(readProjectConfiguration(tree, 'lib1').targets.build.options)
      .toMatchInlineSnapshot(`
      {
        "useLegacyTypescriptPlugin": true,
      }
    `);
  });

  it('should handle projects with no targets', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should handle targets with no options', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: { build: { executor: '@nx/rollup:rollup' } },
    });
    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should strip the property from rollup.config.cjs', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.cjs',
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  compiler: 'tsc',
  format: ['cjs', 'esm'],
  useLegacyTypescriptPlugin: true,
});
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');
      module.exports = withNx({
        outputPath: '../../dist/libs/lib1',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        compiler: 'tsc',
        format: ['cjs', 'esm'],
      });
      "
    `);
  });

  it('should strip the property from rollup.config.mjs', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.mjs',
      `import { withNx } from '@nx/rollup/with-nx';
export default withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  useLegacyTypescriptPlugin: false
});
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withNx } from '@nx/rollup/with-nx';
      export default withNx({
        outputPath: '../../dist/libs/lib1',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
      });
      "
    `);
  });

  it('should strip the property from rollup.config.js', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.js',
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  useLegacyTypescriptPlugin: true,
  format: ['cjs'],
});
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');
      module.exports = withNx({
        outputPath: '../../dist/libs/lib1',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
        format: ['cjs'],
      });
      "
    `);
  });

  it('should strip the property from rollup.config.ts', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.ts',
      `import { withNx } from '@nx/rollup/with-nx';
export default withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  useLegacyTypescriptPlugin: true as boolean,
});
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { withNx } from '@nx/rollup/with-nx';
      export default withNx({
        outputPath: '../../dist/libs/lib1',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
      });
      "
    `);
  });

  it('should leave a rollup.config without withNx untouched', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    const original = `const typescript = require('@rollup/plugin-typescript');
module.exports = {
  input: 'src/index.ts',
  output: { dir: 'dist', format: 'cjs' },
  plugins: [typescript()],
};
`;
    tree.write('libs/lib1/rollup.config.cjs', original);

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8')).toEqual(original);
  });

  it('should leave a withNx config without the flag untouched', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    const original = `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  format: ['cjs', 'esm'],
});
`;
    tree.write('libs/lib1/rollup.config.cjs', original);

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8')).toEqual(original);
  });

  it('should be idempotent across repeated runs', async () => {
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        build: {
          executor: '@nx/rollup:rollup',
          options: {
            outputPath: 'dist/libs/lib1',
            main: 'libs/lib1/src/index.ts',
            tsConfig: 'libs/lib1/tsconfig.lib.json',
            useLegacyTypescriptPlugin: true,
          },
        },
      },
    });
    tree.write(
      'libs/lib1/rollup.config.cjs',
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  useLegacyTypescriptPlugin: true,
});
`
    );

    await migration(tree);
    const afterFirst = {
      project: readProjectConfiguration(tree, 'lib1'),
      config: tree.read('libs/lib1/rollup.config.cjs', 'utf-8'),
    };

    await migration(tree);
    const afterSecond = {
      project: readProjectConfiguration(tree, 'lib1'),
      config: tree.read('libs/lib1/rollup.config.cjs', 'utf-8'),
    };

    expect(afterSecond).toEqual(afterFirst);
  });

  it('should strip every match when a config contains multiple withNx calls', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.cjs',
      `const { withNx } = require('@nx/rollup/with-nx');
module.exports = [
  withNx({
    outputPath: '../../dist/libs/lib1-cjs',
    main: './src/index.ts',
    tsConfig: './tsconfig.lib.json',
    format: ['cjs'],
    useLegacyTypescriptPlugin: true,
  }),
  withNx({
    outputPath: '../../dist/libs/lib1-esm',
    main: './src/index.ts',
    tsConfig: './tsconfig.lib.json',
    format: ['esm'],
    useLegacyTypescriptPlugin: true,
  }),
];
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');
      module.exports = [
        withNx({
          outputPath: '../../dist/libs/lib1-cjs',
          main: './src/index.ts',
          tsConfig: './tsconfig.lib.json',
          format: ['cjs'],
        }),
        withNx({
          outputPath: '../../dist/libs/lib1-esm',
          main: './src/index.ts',
          tsConfig: './tsconfig.lib.json',
          format: ['esm'],
        }),
      ];
      "
    `);
  });

  it('should not strip a property whose value happens to reference useLegacyTypescriptPlugin', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    const original = `const { withNx } = require('@nx/rollup/with-nx');
const useLegacyTypescriptPlugin = false;
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  alias: useLegacyTypescriptPlugin,
});
`;
    tree.write('libs/lib1/rollup.config.cjs', original);

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8')).toEqual(original);
  });

  it('should leave non-rollup config files untouched', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    const original = `module.exports = { useLegacyTypescriptPlugin: true };\n`;
    tree.write('libs/lib1/some-other.config.cjs', original);

    await migration(tree);

    expect(tree.read('libs/lib1/some-other.config.cjs', 'utf-8')).toEqual(
      original
    );
  });

  it('should strip shorthand property { useLegacyTypescriptPlugin } from rollup config', async () => {
    addProjectConfiguration(tree, 'lib1', { root: 'libs/lib1' });
    tree.write(
      'libs/lib1/rollup.config.cjs',
      `const { withNx } = require('@nx/rollup/with-nx');
const useLegacyTypescriptPlugin = false;
module.exports = withNx({
  outputPath: '../../dist/libs/lib1',
  main: './src/index.ts',
  tsConfig: './tsconfig.lib.json',
  useLegacyTypescriptPlugin,
});
`
    );

    await migration(tree);

    expect(tree.read('libs/lib1/rollup.config.cjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { withNx } = require('@nx/rollup/with-nx');
      const useLegacyTypescriptPlugin = false;
      module.exports = withNx({
        outputPath: '../../dist/libs/lib1',
        main: './src/index.ts',
        tsConfig: './tsconfig.lib.json',
      });
      "
    `);
  });

  describe('nx.json targetDefaults', () => {
    it('should strip from executor-keyed targetDefault (@nx/rollup:rollup)', async () => {
      updateNxJson(tree, {
        targetDefaults: {
          '@nx/rollup:rollup': {
            options: {
              useLegacyTypescriptPlugin: true,
              outputPath: 'dist/{projectRoot}',
            },
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
        {
          "@nx/rollup:rollup": {
            "options": {
              "outputPath": "dist/{projectRoot}",
            },
          },
        }
      `);
    });

    it('should strip from executor-keyed targetDefault (@nrwl/rollup:rollup)', async () => {
      updateNxJson(tree, {
        targetDefaults: {
          '@nrwl/rollup:rollup': {
            options: {
              useLegacyTypescriptPlugin: false,
              outputPath: 'dist/{projectRoot}',
            },
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
        {
          "@nrwl/rollup:rollup": {
            "options": {
              "outputPath": "dist/{projectRoot}",
            },
          },
        }
      `);
    });

    it('should strip from target-name-keyed targetDefault with executor field', async () => {
      updateNxJson(tree, {
        targetDefaults: {
          build: {
            executor: '@nx/rollup:rollup',
            options: {
              useLegacyTypescriptPlugin: true,
              outputPath: 'dist/{projectRoot}',
            },
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
        {
          "build": {
            "executor": "@nx/rollup:rollup",
            "options": {
              "outputPath": "dist/{projectRoot}",
            },
          },
        }
      `);
    });

    it('should strip from configurations inside targetDefault', async () => {
      updateNxJson(tree, {
        targetDefaults: {
          '@nx/rollup:rollup': {
            options: { outputPath: 'dist/{projectRoot}' },
            configurations: {
              production: { useLegacyTypescriptPlugin: true, sourceMap: false },
            },
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
        {
          "@nx/rollup:rollup": {
            "configurations": {
              "production": {
                "sourceMap": false,
              },
            },
            "options": {
              "outputPath": "dist/{projectRoot}",
            },
          },
        }
      `);
    });

    it('should leave non-rollup targetDefaults untouched', async () => {
      updateNxJson(tree, {
        targetDefaults: {
          '@nx/vite:build': {
            options: { useLegacyTypescriptPlugin: true },
          },
        },
      });

      await migration(tree);

      expect(readNxJson(tree).targetDefaults).toMatchInlineSnapshot(`
        {
          "@nx/vite:build": {
            "options": {
              "useLegacyTypescriptPlugin": true,
            },
          },
        }
      `);
    });
  });
});
