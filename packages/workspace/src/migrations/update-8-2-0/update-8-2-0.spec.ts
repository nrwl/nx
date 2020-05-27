import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';
import {
  readJsonInTree,
  updateJsonInTree,
} from '@nrwl/workspace/src/utils/ast-utils';

describe('Update 8.2.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createEmptyWorkspace(Tree.empty());
    tree = await callRule(
      updateJsonInTree('workspace.json', (json) => {
        json.projects['my-app'] = {
          root: 'my-app',
          architect: {
            lint: {
              builder: '@angular-devkit/build-angular:tslint',
              options: {
                tsConfig: ['my-app/tsconfig.json'],
                exclude: ['**/node_modules/**'],
              },
            },
          },
        };

        return json;
      }),
      tree
    );
  });

  it('should add exclusions for files other than the project root', async () => {
    const result = await runMigration('update-8.2.0', {}, tree);
    const workspaceJson = readJsonInTree(tree, 'workspace.json');
    const project = workspaceJson.projects['my-app'];
    expect(project.architect.lint).toEqual({
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: ['my-app/tsconfig.json'],
        exclude: ['**/node_modules/**', '!my-app/**/*'],
      },
    });
  });
});
