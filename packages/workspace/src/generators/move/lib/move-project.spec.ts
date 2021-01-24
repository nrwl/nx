import {
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { libraryGenerator } from '../../library/library';
import { moveProject } from '@nrwl/workspace/src/generators/move/lib/move-project';

describe('moveProject', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, { name: 'my-lib' });
    projectConfig = readProjectConfiguration(tree, 'my-lib');
  });

  it('should copy all files and delete the source folder', async () => {
    const schema: Schema = {
      projectName: 'my-lib',
      destination: 'my-destination',
      importPath: undefined,
      updateImportPath: true,
    };

    moveProject(tree, schema, projectConfig);

    const destinationChildren = tree.children('libs/my-destination');
    expect(destinationChildren.length).toBeGreaterThan(0);

    expect(tree.exists('libs/my-lib')).toBeFalsy();
    expect(tree.children('libs')).not.toContain('my-lib');
  });
});
