import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { getFileContent } from '@nrwl/workspace/testing';

import { runMigration } from '../../utils/testing';

describe('Update 10-2-1', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();

    // create workspace
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          ['home-ui-angular']: {
            projectType: 'library',
            root: 'libs/home/ui-angular',
            sourceRoot: 'libs/home/ui-angular/src',
            prefix: 'app',
            architect: {
              storybook: {
                builder: '@nrwl/storybook:storybook',
                options: {
                  uiFramework: '@storybook/angular',
                  port: 4400,
                  config: {
                    configFolder: 'libs/home/ui-angular/.storybook',
                  },
                },
              },
            },
          },
        },
      })
    );

    tree.create(
      'libs/home/ui-angular/.storybook/tsconfig.json',
      JSON.stringify({
        extends: '../../../../tsconfig.base.json',
      })
    );
  });

  it(`should properly fix the storybook tsconfig extends property to point to the lib relative tsconfig.json`, async () => {
    tree = await runMigration('update-10.2.1', {}, tree);

    const config = readWorkspace(tree);

    expect(
      getFileContent(tree, 'libs/home/ui-angular/.storybook/tsconfig.json')
    ).toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../tsconfig.json\\"
      }
      "
    `);
  });
});
