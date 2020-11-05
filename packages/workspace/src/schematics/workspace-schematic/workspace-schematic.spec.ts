import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import workspaceSchematic from './workspace-schematic';

describe('workspace-schematic', () => {
  it('should generate a target', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const opts = {
      name: 'custom',
      skipFormat: true,
    };

    await workspaceSchematic(opts)(tree);

    expect(tree.exists('tools/schematics/custom/index.ts')).toBeTruthy();
    expect(tree.exists('tools/schematics/custom/schema.json')).toBeTruthy();
  });
});
