import {
  addProjectConfiguration,
  readProjectConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { Schema } from '../schema';
import { removeProjectReferencesInConfig } from './remove-project-references-in-config';

describe('removeProjectReferencesInConfig', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

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
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/ng-app-e2e/cypress.json',
            tsConfig: 'apps/ng-app-e2e/tsconfig.e2e.json',
            devServerTarget: 'ng-app:serve',
          },
        },
      },
      implicitDependencies: ['ng-app'],
    });
  });

  describe('defaultProject', () => {
    beforeEach(async () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        defaultProject: 'ng-app',
      });
    });

    it('should remove defaultProject if it matches the project being deleted', async () => {
      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const { defaultProject } = readNxJson(tree);
      expect(defaultProject).toBeUndefined();
    });

    it('should not remove defaultProject if it does not match the project being deleted', async () => {
      schema = {
        projectName: 'ng-app-e2e',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const { defaultProject } = readNxJson(tree);
      expect(defaultProject).toEqual('ng-app');
    });

    it('should remove implicit dependencies onto the removed project', () => {
      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const { implicitDependencies } = readProjectConfiguration(
        tree,
        'ng-app-e2e'
      );

      expect(implicitDependencies).not.toContain('ng-app');
    });
  });
});
