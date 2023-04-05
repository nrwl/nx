import {
  ensurePackage,
  NX_VERSION,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Schema } from '../schema';
import { removeProject } from '@nrwl/workspace/src/generators/remove/lib/remove-project';

// avoid circular deps
const { libraryGenerator } = ensurePackage('@nrwl/js', NX_VERSION);

describe('moveProject', () => {
  let schema: Schema;
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await libraryGenerator(tree, {
      name: 'my-lib',
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
