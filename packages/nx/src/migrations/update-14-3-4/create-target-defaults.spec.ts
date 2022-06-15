import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../../generators/tree';
import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '../../generators/utils/project-configuration';
import createTargetDefaults from 'nx/src/migrations/update-14-3-4/create-target-defaults';

describe('createTargetDefaults', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should work', async () => {
    const config = readWorkspaceConfiguration(tree);
    config.targetDependencies = {
      a: [],
      b: [
        'bb',
        { target: 'bbb', projects: 'self' },
        { target: 'c', projects: 'dependencies' },
      ],
    };
    updateWorkspaceConfiguration(tree, config);
    await createTargetDefaults(tree);

    const updated = readWorkspaceConfiguration(tree);
    expect(updated.targetDefaults).toEqual({
      a: { dependsOn: [] },
      b: {
        dependsOn: ['bb', 'bbb', '^c'],
      },
    });
    expect(updated.targetDependencies).toBeUndefined();
  });
});
