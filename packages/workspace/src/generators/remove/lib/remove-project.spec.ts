import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyV1Workspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { libraryGenerator } from '../../library/library';
import { removeProject } from '@nrwl/workspace/src/generators/remove/lib/remove-project';

describe('moveProject', () => {
  let schema: Schema;
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyV1Workspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      standaloneConfig: false,
    });

    schema = {
      projectName: 'my-lib',
      skipFormat: false,
      forceRemove: false,
    };
  });

  it('should delete the project folder', async () => {
    const config = readProjectConfiguration(tree, 'my-lib');
    removeProject(tree, config);
    expect(tree.children('libs')).not.toContain('my-lib');
  });
});
