import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { checkTargets } from './check-targets';

describe('checkTargets', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schema = {
      projectName: 'ng-app',
      skipFormat: false,
      forceRemove: false,
    };

    addProjectConfiguration(tree, 'ng-app', {
      projectType: 'application',
      root: 'apps/ng-app',
      sourceRoot: 'apps/ng-app/src',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {},
        },
        serve: {
          executor: '@angular-devkit/build-angular:dev-server',
          options: {},
        },
        storybook: {
          executor: '@nrwl/storybook:storybook',
          options: {},
        },
      },
    });

    addProjectConfiguration(tree, 'storybook', {
      projectType: 'application',
      root: 'apps/storybook',
      sourceRoot: 'apps/storybook/src',
      targets: {
        storybook: {
          executor: '@nrwl/storybook:storybook',
        },
      },
    });

    addProjectConfiguration(tree, 'ng-app-e2e', {
      root: 'apps/ng-app-e2e',
      sourceRoot: 'apps/ng-app-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nrwl/cypress:cypress',
          options: {
            cypressConfig: 'apps/ng-app-e2e/cypress.json',
            tsConfig: 'apps/ng-app-e2e/tsconfig.e2e.json',
            devServerTarget: 'ng-app:serve',
          },
        },
      },
    });
  });

  it('should throw an error if another project targets', async () => {
    expect(() => {
      checkTargets(tree, schema);
    }).toThrowErrorMatchingInlineSnapshot(`
      "ng-app is still targeted by some projects:

      \\"ng-app:serve\\" is used by \\"ng-app-e2e\\"
      "
    `);
  });

  it('should NOT throw an error if no other project targets', async () => {
    schema.projectName = 'ng-app-e2e';

    expect(() => {
      checkTargets(tree, schema);
    }).not.toThrow();
  });

  it('should NOT throw an error if it is a nrwl package', async () => {
    schema.projectName = 'storybook';

    expect(() => {
      checkTargets(tree, schema);
    }).not.toThrow();
  });

  it('should not error if forceRemove is true', async () => {
    schema.forceRemove = true;

    expect(() => {
      checkTargets(tree, schema);
    }).not.toThrow();
  });

  describe('use project in other project target', () => {
    beforeEach(() => {
      addProjectConfiguration(tree, 'other', {
        projectType: 'application',
        root: 'apps/storybook',
        sourceRoot: 'apps/storybook/src',
        targets: {
          storybook: {
            executor: '@nrwl/storybook:storybook',
          },
          serve: {
            executor: '@angular-devkit/build-angular:dev-server',
            options: {
              browserTarget: 'storybook:build',
            },
          },
        },
      });
    });

    it('should throw an error since it is used as a target in another project', async () => {
      schema.projectName = 'storybook';

      expect(() => {
        checkTargets(tree, schema);
      }).toThrow();
    });
  });
});
