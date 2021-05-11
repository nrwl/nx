import { Tree } from '@angular-devkit/schematics';
import { writeJsonInTree } from '@nrwl/workspace';
import { getFileContent } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('Update 11-5-3', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();

    // create workspace
    writeJsonInTree(tree, 'workspace.json', {
      projects: {
        ['home-ui-react']: {
          projectType: 'library',
          root: 'libs/home/ui-react',
          sourceRoot: 'libs/home/ui-react/src',
          architect: {
            storybook: {
              builder: '@nrwl/storybook:storybook',
              options: {
                uiFramework: '@storybook/react',
                port: 4400,
                config: {
                  configFolder: 'libs/home/ui-react/.storybook',
                },
              },
            },
          },
        },
      },
    });

    writeJsonInTree(tree, 'libs/home/ui-react/.storybook/tsconfig.json', {
      extends: '../tsconfig.json',
      include: ['../src/**/*'],
    });
  });

  it(`should add storybook tsconfig to lint target and update tsconfigs in project for React project`, async () => {
    tree = await runMigration('update-11-5-3', {}, tree);

    expect(getFileContent(tree, 'libs/home/ui-react/.storybook/tsconfig.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../tsconfig.json\\",
        \\"include\\": [\\"../src/**/*\\", \\"./*.js\\"]
      }
      "
    `);
  });
});
