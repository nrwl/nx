import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import workspaceGenerator from './workspace-generator';

describe('workspace-generator', () => {
  it('should generate a target', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const opts = {
      name: 'custom',
      skipFormat: true,
    };

    await workspaceGenerator(tree, opts);

    expect(tree.exists('tools/generators/custom/index.ts')).toBeTruthy();
    expect(tree.exists('tools/generators/custom/schema.json')).toBeTruthy();
  });
});
