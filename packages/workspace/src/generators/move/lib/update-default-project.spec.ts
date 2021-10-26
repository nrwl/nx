import {
  addProjectConfiguration,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { NormalizedSchema } from '../schema';
import { updateDefaultProject } from './update-default-project';

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
    const schema: NormalizedSchema = {
      projectName: 'my-source',
      destination: 'subfolder/my-destination',
      importPath: '@proj/subfolder/my-destination',
      updateImportPath: true,
      newProjectName: 'subfolder-my-destination',
      relativeToRootDestination: 'libs/subfolder/my-destination',
    };

    updateDefaultProject(tree, schema);

    const { defaultProject } = readWorkspaceConfiguration(tree);
    expect(defaultProject).toBe('subfolder-my-destination');
  });
});
