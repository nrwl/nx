import { Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  readWorkspaceJson,
  getProjectConfig,
} from '@nrwl/workspace';
import { createTestUILib, runSchematic } from '../../utils/testing';
import { StorybookConfigureSchema } from './schema';

describe('schematic:configuration', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUILib('test-ui-lib');
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );

    expect(tree.exists('libs/test-ui-lib/.storybook/addons.js')).toBeTruthy();
    expect(tree.exists('libs/test-ui-lib/.storybook/config.js')).toBeTruthy();
    expect(
      tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
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
  });

  it('should update `tsconfig.lib.json` file', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );
    const tsconfigLibJson = readJsonInTree(
      tree,
      'libs/test-ui-lib/tsconfig.lib.json'
    );
    expect(tsconfigLibJson.exclude.includes('**/*.stories.ts')).toBeTruthy();
  });
});
