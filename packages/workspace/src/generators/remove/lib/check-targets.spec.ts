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
    }).toThrow();
  });

  it('should NOT throw an error if no other project targets', async () => {
    schema.projectName = 'ng-app-e2e';

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
});
