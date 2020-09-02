import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, getProjectConfig } from '@nrwl/workspace';

import { createTestUILib, runSchematic } from '../../utils/testing';
import { getTsConfigContent, TsConfig } from '../../utils/utils';

describe('schematic:configuration', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib', '@nrwl/angular');
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );

    // Root
    expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
    const rootStorybookTsconfigJson = readJsonInTree<TsConfig>(
      tree,
      '.storybook/tsconfig.json'
    );
    expect(rootStorybookTsconfigJson.exclude).toEqual([
      '../**/*.spec.js',
      '../**/*.spec.ts',
      '../**/*.spec.tsx',
      '../**/*.spec.jsx',
    ]);

    // Local
    expect(tree.exists('libs/test-ui-lib/.storybook/addons.js')).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/config.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();

    const storybookTsconfigJson = readJsonInTree<{ exclude: string[] }>(
      tree,
      'libs/test-ui-lib/.storybook/tsconfig.json'
    );

    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.ts')
    ).toBeTruthy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.tsx')
    ).toBeFalsy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.js')
    ).toBeFalsy();
    expect(
      storybookTsconfigJson.exclude.includes('../**/*.spec.jsx')
    ).toBeFalsy();
  });

  it('should update workspace file', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );
    const project = getProjectConfig(tree, 'test-ui-lib');

    expect(project.architect.storybook).toEqual({
      builder: '@nrwl/storybook:storybook',
      configurations: {
        ci: {
          quiet: true,
        },
      },
      options: {
        port: 4400,
        config: {
          configFolder: 'libs/test-ui-lib/.storybook',
        },
      },
    });

    expect(project.architect.lint).toEqual({
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        exclude: ['**/node_modules/**', '!libs/test-ui-lib/**/*'],
        tsConfig: [
          'libs/test-ui-lib/tsconfig.lib.json',
          'libs/test-ui-lib/tsconfig.spec.json',
          'libs/test-ui-lib/.storybook/tsconfig.json',
        ],
      },
    });
  });

  it('should update `tsconfig.lib.json` file', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );
    const tsconfigJson = getTsConfigContent(
      tree,
      'libs/test-ui-lib/tsconfig.lib.json'
    ) as Required<TsConfig>;

    expect(tsconfigJson.exclude.includes('**/*.stories.ts')).toBeTruthy();
    expect(tsconfigJson.exclude.includes('**/*.stories.js')).toBeTruthy();
    expect(tsconfigJson.exclude.includes('**/*.stories.jsx')).toBeFalsy();
    expect(tsconfigJson.exclude.includes('**/*.stories.tsx')).toBeFalsy();
  });

  it('should update `tsconfig.json` file', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );
    const tsconfigJson = getTsConfigContent(
      tree,
      'libs/test-ui-lib/tsconfig.json'
    );

    expect(tsconfigJson.references).toMatchInlineSnapshot(`
      Array [
        Object {
          "path": "./tsconfig.lib.json",
        },
        Object {
          "path": "./tsconfig.spec.json",
        },
        Object {
          "path": "./.storybook/tsconfig.json",
        },
      ]
    `);
  });
});
