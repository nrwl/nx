import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../utils/testing-utils';
import { callRule, runMigration } from '../../utils/testing';
import { readJsonInTree, updateJsonInTree } from '../../utils/ast-utils';
import { NxJson } from '../../core/shared-interfaces';

describe('Update 8.12.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateJsonInTree<NxJson>('nx.json', (json) => {
        json.projects['my-app'] = {
          tags: [],
        };
        json.projects['my-app-e2e'] = {
          tags: [],
        };
        json.projects['my-non-existent-app-e2e'] = {
          tags: [],
        };
        return json;
      }),
      tree
    );
  });

  it('should add implicit dependencies for e2e projects', async () => {
    const result = await runMigration('add-implicit-e2e-deps', {}, tree);

    const nxJson = readJsonInTree<NxJson>(result, 'nx.json');

    expect(nxJson.projects['my-app-e2e']).toEqual({
      tags: [],
      implicitDependencies: ['my-app'],
    });

    expect(nxJson.projects['my-non-existent-app-e2e']).toEqual({
      tags: [],
    });
  });

  it('should not add duplicate implicit dependencies for e2e projects', async () => {
    tree = await callRule(
      updateJsonInTree<NxJson>('nx.json', (json) => {
        json.projects['my-app-e2e'].implicitDependencies = ['my-app'];
        return json;
      }),
      tree
    );
    const result = await runMigration('add-implicit-e2e-deps', {}, tree);

    const nxJson = readJsonInTree<NxJson>(result, 'nx.json');

    expect(nxJson.projects['my-app-e2e']).toEqual({
      tags: [],
      implicitDependencies: ['my-app'],
    });

    expect(nxJson.projects['my-non-existent-app-e2e']).toEqual({
      tags: [],
    });
  });
});
