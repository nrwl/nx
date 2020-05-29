import { Tree } from '@angular-devkit/schematics';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { updateWorkspaceInTree } from '@nrwl/workspace/src/utils/ast-utils';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule } from '../../../utils/testing';
import { Schema } from '../schema';
import { checkTargets } from './check-targets';

describe('checkTargets Rule', () => {
  let tree: UnitTestTree;
  let schema: Schema;

  beforeEach(async () => {
    tree = new UnitTestTree(Tree.empty());
    tree = createEmptyWorkspace(tree) as UnitTestTree;

    schema = {
      projectName: 'ng-app',
      skipFormat: false,
      forceRemove: false,
    };

    tree = (await callRule(
      updateWorkspaceInTree((workspace) => {
        return {
          version: 1,
          projects: {
            'ng-app': {
              projectType: 'application',
              schematics: {},
              root: 'apps/ng-app',
              sourceRoot: 'apps/ng-app/src',
              prefix: 'happyorg',
              architect: {
                build: {
                  builder: '@angular-devkit/build-angular:browser',
                  options: {},
                },
              },
            },
            'ng-app-e2e': {
              root: 'apps/ng-app-e2e',
              sourceRoot: 'apps/ng-app-e2e/src',
              projectType: 'application',
              architect: {
                e2e: {
                  builder: '@nrwl/cypress:cypress',
                  options: {
                    cypressConfig: 'apps/ng-app-e2e/cypress.json',
                    tsConfig: 'apps/ng-app-e2e/tsconfig.e2e.json',
                    devServerTarget: 'ng-app:serve',
                  },
                },
              },
            },
          },
        };
      }),
      tree
    )) as UnitTestTree;
  });

  it('should throw an error if another project targets', async () => {
    await expect(callRule(checkTargets(schema), tree)).rejects.toThrow();
  });

  it('should NOT throw an error if no other project targets', async () => {
    schema.projectName = 'ng-app-e2e';

    await expect(callRule(checkTargets(schema), tree)).resolves.not.toThrow();
  });

  it('should not error if forceRemove is true', async () => {
    schema.forceRemove = true;

    await expect(callRule(checkTargets(schema), tree)).resolves.not.toThrow();
  });
});
