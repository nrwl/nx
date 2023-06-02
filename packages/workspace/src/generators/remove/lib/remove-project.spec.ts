import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Schema } from '../schema';
import { removeProject } from './remove-project';

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

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
