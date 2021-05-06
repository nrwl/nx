import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  updateJsonInTree,
  readJsonInTree,
  updateWorkspaceInTree,
  readWorkspace,
  getWorkspacePath,
} from '@nrwl/workspace';

import * as path from 'path';

describe('Update 8-8-2', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/storybook',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should remove headless/watch as options for e2e builder`, async () => {
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          ['home-ui']: {
            projectType: 'library',
            root: 'libs/home/ui',
            sourceRoot: 'libs/home/ui/src',
            prefix: 'app',
            architect: {
              storybook: {
                builder: '@nrwl/storybook:storybook',
                options: {
                  uiFramework: '@storybook/angular',
                  port: 4400,
                  config: {
                    configFolder: 'libs/home/ui/.storybook',
                  },
                },
              },
            },
          },
          ['home-ui-e2e']: {
            root: 'apps/home-ui-e2e',
            sourceRoot: 'apps/home-ui-e2e/src',
            architect: {
              e2e: {
                builder: '@nrwl/cypress:cypress',
                options: {
                  cypressConfig: 'apps/home-ui-e2e/cypress.json',
                  tsConfig: 'apps/home-ui-e2e/tsconfig.e2e.json',
                  devServerTarget: 'home-ui:storybook',
                  headless: false,
                  watch: true,
                },
                configurations: {
                  headless: {
                    devServerTarget: 'home-ui:storybook:ci',
                    headless: true,
                  },
                },
              },
            },
          },
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-builder-8.8.2', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    expect(
      config.projects['home-ui-e2e'].architect.e2e.options.headless
    ).toBeUndefined();
    expect(
      config.projects['home-ui-e2e'].architect.e2e.options.watch
    ).toBeUndefined();
    expect(
      config.projects['home-ui-e2e'].architect.e2e.configurations
    ).toBeUndefined();
  });

  it(`should add emitDecoratorMetadata to storybook tsconfig.json`, async () => {
    tree.create(
      'libs/home/ui/.storybook/tsconfig.json',
      JSON.stringify({
        extends: '../tsconfig.json',
        exclude: ['../src/test.ts', '../**/*.spec.ts'],
        include: ['../src/**/*'],
      })
    );
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          ['home-ui']: {
            projectType: 'library',
            root: 'libs/home/ui',
            sourceRoot: 'libs/home/ui/src',
            prefix: 'app',
            architect: {
              storybook: {
                builder: '@nrwl/storybook:storybook',
                options: {
                  uiFramework: '@storybook/angular',
                  port: 4400,
                  config: {
                    configFolder: 'libs/home/ui/.storybook',
                  },
                },
              },
            },
          },
          ['home-ui-e2e']: {
            root: 'apps/home-ui-e2e',
            sourceRoot: 'apps/home-ui-e2e/src',
            architect: {
              e2e: {
                builder: '@nrwl/cypress:cypress',
                options: {
                  cypressConfig: 'apps/home-ui-e2e/cypress.json',
                  tsConfig: 'apps/home-ui-e2e/tsconfig.e2e.json',
                  devServerTarget: 'home-ui:storybook',
                  headless: false,
                  watch: true,
                },
                configurations: {
                  headless: {
                    devServerTarget: 'home-ui:storybook:ci',
                    headless: true,
                  },
                },
              },
            },
          },
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('update-builder-8.8.2', {}, tree)
      .toPromise();

    const tsconfig = readJsonInTree(
      tree,
      'libs/home/ui/.storybook/tsconfig.json'
    );
    expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
  });
});
