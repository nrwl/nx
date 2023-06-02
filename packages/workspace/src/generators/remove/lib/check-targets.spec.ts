import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Schema } from '../schema';
import { checkTargets } from './check-targets';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('checkTargets', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

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
          executor: '@nx/storybook:storybook',
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
          executor: '@nx/storybook:storybook',
        },
      },
    });

    addProjectConfiguration(tree, 'ng-app-e2e', {
      root: 'apps/ng-app-e2e',
      sourceRoot: 'apps/ng-app-e2e/src',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
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
    await expect(checkTargets(tree, schema)).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      "ng-app is still targeted by some projects:

      "ng-app:serve" is used by "ng-app-e2e"
      "
    `);
  });

  it('should NOT throw an error if no other project targets', async () => {
    schema.projectName = 'ng-app-e2e';

    await expect(checkTargets(tree, schema)).resolves.toBeUndefined();
  });

  it('should NOT throw an error if it is a nrwl package', async () => {
    schema.projectName = 'storybook';

    await expect(checkTargets(tree, schema)).resolves.toBeUndefined();
  });

  it('should not error if forceRemove is true', async () => {
    schema.forceRemove = true;

    await expect(checkTargets(tree, schema)).resolves.toBeUndefined();
  });
});
