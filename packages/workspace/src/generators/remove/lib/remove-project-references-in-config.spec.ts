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

  describe('conformance rules', () => {
    it('should remove the project from conformance rules projects', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: ['ng-app', 'ng-app-e2e', 'other-project'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.conformance.rules[0].projects).toEqual([
        'ng-app-e2e',
        'other-project',
      ]);
    });

    it('should remove the project from conformance rules with matcher objects', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: [
                { matcher: 'ng-app', explanation: 'some reason' },
                'other-project',
              ],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.conformance.rules[0].projects).toEqual([
        'other-project',
      ]);
    });

    it('should not modify conformance rules without projects', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        conformance: {
          rules: [{ rule: './some-rule' }],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.conformance.rules[0].projects).toBeUndefined();
    });

    it('should not remove glob patterns or tag references from conformance rules', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        conformance: {
          rules: [
            {
              rule: './some-rule',
              projects: ['ng-app', 'tag:frontend', 'lib-*'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.conformance.rules[0].projects).toEqual([
        'tag:frontend',
        'lib-*',
      ]);
    });

    it('should handle multiple conformance rules', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        conformance: {
          rules: [
            {
              rule: './rule-a',
              projects: ['ng-app', 'other-project'],
            },
            {
              rule: './rule-b',
              projects: ['ng-app', 'another-project'],
            },
            {
              rule: './rule-c',
              projects: ['unrelated-project'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.conformance.rules[0].projects).toEqual([
        'other-project',
      ]);
      expect(updatedNxJson.conformance.rules[1].projects).toEqual([
        'another-project',
      ]);
      expect(updatedNxJson.conformance.rules[2].projects).toEqual([
        'unrelated-project',
      ]);
    });
  });

  describe('owners patterns', () => {
    it('should remove the project from owners patterns projects', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        owners: {
          patterns: [
            {
              projects: ['ng-app', 'ng-app-e2e', 'other-project'],
              owners: ['@team'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.owners.patterns[0].projects).toEqual([
        'ng-app-e2e',
        'other-project',
      ]);
    });

    it('should not modify owners patterns without projects', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        owners: {
          patterns: [
            {
              files: ['.github/workflows/**/*'],
              owners: ['@devops'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.owners.patterns[0].projects).toBeUndefined();
    });

    it('should not remove glob patterns or tag references from owners patterns', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        owners: {
          patterns: [
            {
              projects: ['ng-app', 'tag:rust', 'finance-*'],
              owners: ['@team'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.owners.patterns[0].projects).toEqual([
        'tag:rust',
        'finance-*',
      ]);
    });

    it('should handle multiple owners patterns', () => {
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        owners: {
          patterns: [
            {
              projects: ['ng-app', 'other-project'],
              owners: ['@team-a'],
            },
            {
              projects: ['ng-app', 'another-project'],
              owners: ['@team-b'],
            },
            {
              projects: ['unrelated-project'],
              owners: ['@team-c'],
            },
          ],
        },
      } as any);

      schema = {
        projectName: 'ng-app',
        skipFormat: false,
        forceRemove: false,
      };

      removeProjectReferencesInConfig(tree, schema);

      const updatedNxJson = readNxJson(tree) as any;
      expect(updatedNxJson.owners.patterns[0].projects).toEqual([
        'other-project',
      ]);
      expect(updatedNxJson.owners.patterns[1].projects).toEqual([
        'another-project',
      ]);
      expect(updatedNxJson.owners.patterns[2].projects).toEqual([
        'unrelated-project',
      ]);
    });
  });
});
