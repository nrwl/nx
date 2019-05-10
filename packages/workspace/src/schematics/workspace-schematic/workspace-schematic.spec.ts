import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('workspace-schematic', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createEmptyWorkspace(Tree.empty());
  });

  it('should generate files', async () => {
    const tree = await runSchematic(
      'workspace-schematic',
      { name: 'custom' },
      appTree
    );
    expect(tree.exists('tools/schematics/custom/index.ts')).toBeTruthy();
    expect(tree.exists('tools/schematics/custom/schema.json')).toBeTruthy();
  });
});
