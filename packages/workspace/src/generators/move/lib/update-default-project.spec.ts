import { Schema } from '@nrwl/workspace/src/generators/move/schema';
import {
  addProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { updateDefaultProject } from '@nrwl/workspace/src/generators/move/lib/update-default-project';

describe('updateDefaultProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'my-source', {
      root: 'libs/my-source',
      targets: {},
    });

    const workspace = readWorkspaceConfiguration(tree);

    updateWorkspaceConfiguration(tree, {
      ...workspace,
      defaultProject: 'my-source',
    });
  });

  it('should update the default project', async () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    updateDefaultProject(tree, schema);

    const { defaultProject } = readWorkspaceConfiguration(tree);

    expect(defaultProject).toBe('subfolder-my-destination');
  });
});
