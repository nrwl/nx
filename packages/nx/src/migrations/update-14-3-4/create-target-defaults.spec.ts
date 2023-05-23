import { assertRunsAgainstNxRepo } from '../../../internal-testing-utils/run-migration-against-this-workspace';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  readNxJson,
  updateNxJson,
} from '../../generators/utils/project-configuration';
import createTargetDefaults from './create-target-defaults';

describe('createTargetDefaults', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should work', async () => {
    const nxJson = readNxJson(tree);
    (nxJson as any).targetDependencies = {
      a: [],
      b: [
        'bb',
        { target: 'bbb', projects: 'self' },
        { target: 'c', projects: 'dependencies' },
      ],
    };
    updateNxJson(tree, nxJson);
    await createTargetDefaults(tree);

    const updated = readNxJson(tree);
    expect(updated.targetDefaults).toEqual({
      a: { dependsOn: [] },
      b: {
        dependsOn: ['bb', 'bbb', '^c'],
      },
    });
    expect((updated as any).targetDependencies).toBeUndefined();
  });

  it('should not error when nxJson does not exist', async () => {
    tree.delete('nx.json');
    await expect(createTargetDefaults(tree)).resolves.not.toThrow();
  });

  assertRunsAgainstNxRepo(createTargetDefaults);
});
