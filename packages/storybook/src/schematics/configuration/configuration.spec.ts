import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
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

  it('should update `angular.json` file', async () => {
    const tree = await runSchematic(
      'configuration',
      { name: 'test-ui-lib' },
      appTree
    );
    const angularJson = readJsonInTree(tree, 'angular.json');
    const project = angularJson.projects['test-ui-lib'];

    expect(project.architect.storybook).toEqual({
      builder: '@nrwl/storybook:storybook',
      options: {
        port: 4400,
        config: {
          configFolder: 'libs/test-ui-lib/.storybook'
        }
      }
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
