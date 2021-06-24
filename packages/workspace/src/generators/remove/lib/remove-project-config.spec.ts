import {
  addProjectConfiguration,
  readProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Schema } from '../schema';
import { removeProjectConfig } from './remove-project-config';

describe('removeProjectConfig', () => {
  let tree: Tree;
  let schema: Schema;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

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
      implicitDependencies: ['ng-app'],
    });
  });

  describe('delete project', () => {
    beforeEach(async () => {
      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };
    });

    it('should delete the project', async () => {
      removeProjectConfig(tree, schema);

      expect(() => {
        readProjectConfiguration(tree, schema.projectName);
      }).toThrow();
    });
  });

  describe('defaultProject', () => {
    beforeEach(async () => {
      const workspaceConfig = readWorkspaceConfiguration(tree);
      updateWorkspaceConfiguration(tree, {
        ...workspaceConfig,
        defaultProject: 'ng-app',
      });
    });

    it('should remove defaultProject if it matches the project being deleted', async () => {
      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectConfig(tree, schema);

      const { defaultProject } = readWorkspaceConfiguration(tree);
      expect(defaultProject).toBeUndefined();
    });

    it('should not remove defaultProject if it does not match the project being deleted', async () => {
      schema = {
        projectName: 'ng-app-e2e',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectConfig(tree, schema);

      const { defaultProject } = readWorkspaceConfiguration(tree);
      expect(defaultProject).toEqual('ng-app');
    });

    it('should remove implicit dependencies onto the removed project', () => {
      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectConfig(tree, schema);

      const { implicitDependencies } = readProjectConfiguration(
        tree,
        'ng-app-e2e'
      );

      expect(implicitDependencies).not.toContain('ng-app');
    });
  });
});
