import { Tree } from '@angular-devkit/schematics';
import { readWorkspace } from '@nrwl/workspace';
import { getFileContent } from '@nrwl/workspace/testing';

import { runMigration } from '../../utils/testing';

describe('Update 10-3-0', () => {
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
              lint: {
                builder: '@nrwl/linter:lint',
                options: {
                  linter: 'eslint',
                  config: 'libs/home/ui-angular/.eslintrc',
                  tsConfig: [
                    'libs/home/ui-angular/tsconfig.lib.json',
                    'libs/home/ui-angular/tsconfig.spec.json',
                  ],
                  exclude: ['**/node_modules/**'],
                },
              },
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
          ['home-ui-react']: {
            projectType: 'library',
            root: 'libs/home/ui-react',
            sourceRoot: 'libs/home/ui-react/src',
            architect: {
              lint: {
                builder: '@nrwl/linter:lint',
                options: {
                  linter: 'eslint',
                  config: 'libs/home/ui-react/.eslintrc',
                  tsConfig: [
                    'libs/home/ui-react/tsconfig.lib.json',
                    'libs/home/ui-react/tsconfig.spec.json',
                  ],
                  exclude: ['**/node_modules/**'],
                },
              },
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
      })
    );

    // create angular lib
    tree.create(
      'libs/home/ui-angular/tsconfig.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        references: [
          {
            path: './tsconfig.lib.json',
          },
          {
            path: './tsconfig.spec.json',
          },
        ],
      })
    );
    tree.create(
      'libs/home/ui-angular/tsconfig.lib.json',
      JSON.stringify({
        extends: './tsconfig.json',
        exclude: ['**/*.spec.ts'],
        include: ['**/*.ts'],
      })
    );
    tree.create(
      'libs/home/ui-angular/.storybook/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.json',
        exclude: ['../**/*.spec.ts'],
        include: ['../src/**/*'],
      })
    );

    // create react lib
    tree.create(
      'libs/home/ui-react/tsconfig.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        references: [
          {
            path: './tsconfig.lib.json',
          },
          {
            path: './tsconfig.spec.json',
          },
        ],
      })
    );
    tree.create(
      'libs/home/ui-react/tsconfig.lib.json',
      JSON.stringify({
        extends: './tsconfig.json',
        exclude: ['**/*.spec.ts', '**/*.spec.tsx'],
        include: ['**/*.ts', '**/*.tsx'],
      })
    );
    tree.create(
      'libs/home/ui-react/.storybook/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.json',
        exclude: ['../**/*.spec.ts'],
        include: ['../src/**/*'],
      })
    );
  });

  it(`should add storybook tsconfig to lint target and update tsconfigs in project for Angular project`, async () => {
    tree = await runMigration('update-10.3.1', {}, tree);

    const config = readWorkspace(tree);

    expect(
      config.projects['home-ui-angular'].architect.lint.options.tsConfig
    ).toEqual([
      'libs/home/ui-angular/tsconfig.lib.json',
      'libs/home/ui-angular/tsconfig.spec.json',
      'libs/home/ui-angular/.storybook/tsconfig.json',
    ]);

    expect(getFileContent(tree, 'libs/home/ui-angular/tsconfig.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../../tsconfig.base.json\\",
        \\"references\\": [
          {
            \\"path\\": \\"./tsconfig.lib.json\\"
          },
          {
            \\"path\\": \\"./tsconfig.spec.json\\"
          },
          {
            \\"path\\": \\".storybook/tsconfig.json\\"
          }
        ]
      }
      "
    `);
    expect(getFileContent(tree, 'libs/home/ui-angular/tsconfig.lib.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"./tsconfig.json\\",
        \\"exclude\\": [\\"**/*.spec.ts\\"],
        \\"include\\": [\\"**/*.ts\\"]
      }
      "
    `);
    expect(
      getFileContent(tree, 'libs/home/ui-angular/.storybook/tsconfig.json')
    ).toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../tsconfig.json\\",
        \\"exclude\\": [\\"../**/*.spec.ts\\"],
        \\"include\\": [\\"../src/**/*\\"]
      }
      "
    `);
  });

  it(`should add storybook tsconfig to lint target and update tsconfigs in project for React project`, async () => {
    tree = await runMigration('update-10.3.1', {}, tree);

    const config = readWorkspace(tree);

    expect(
      config.projects['home-ui-react'].architect.lint.options.tsConfig
    ).toEqual([
      'libs/home/ui-react/tsconfig.lib.json',
      'libs/home/ui-react/tsconfig.spec.json',
      'libs/home/ui-react/.storybook/tsconfig.json',
    ]);

    expect(getFileContent(tree, 'libs/home/ui-react/tsconfig.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../../tsconfig.base.json\\",
        \\"references\\": [
          {
            \\"path\\": \\"./tsconfig.lib.json\\"
          },
          {
            \\"path\\": \\"./tsconfig.spec.json\\"
          },
          {
            \\"path\\": \\".storybook/tsconfig.json\\"
          }
        ]
      }
      "
    `);
    expect(getFileContent(tree, 'libs/home/ui-react/tsconfig.lib.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"./tsconfig.json\\",
        \\"exclude\\": [
          \\"**/*.spec.ts\\",
          \\"**/*.spec.tsx\\",
          \\"**/*.stories.jsx\\",
          \\"**/*.stories.tsx\\"
        ],
        \\"include\\": [\\"**/*.ts\\", \\"**/*.tsx\\"]
      }
      "
    `);
    expect(getFileContent(tree, 'libs/home/ui-react/.storybook/tsconfig.json'))
      .toMatchInlineSnapshot(`
      "{
        \\"extends\\": \\"../tsconfig.json\\",
        \\"exclude\\": [
          \\"../**/*.spec.ts\\",
          \\"../**/*.spec.js\\",
          \\"../**/*.spec.tsx\\",
          \\"../**/*.spec.jsx\\"
        ],
        \\"include\\": [\\"../src/**/*\\"]
      }
      "
    `);
  });
});
