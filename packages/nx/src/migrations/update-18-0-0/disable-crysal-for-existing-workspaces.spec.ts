import { createTree } from '../../generators/testing-utils/create-tree';
import migrate from './disable-crystal-for-existing-workspaces';

describe('disable crystal for existing workspaces', () => {
  it("should create a .env if it doesn't exist", () => {
    const tree = createTree();
    migrate(tree);
    expect(tree.read('.env', 'utf-8')).toMatchInlineSnapshot(`
      "# Nx 18 enables using plugins to infer targets by default
      # This is disabled for existing workspaces to maintain compatibility
      # For more info, see: https://nx.dev/concepts/inferred-tasks
      NX_ADD_PLUGINS=false"
    `);
  });

  it('should update an existing .env', () => {
    const tree = createTree();
    tree.write('.env', 'FOO=bar');
    migrate(tree);
    expect(tree.read('.env', 'utf-8')).toMatchInlineSnapshot(`
      "FOO=bar

      # Nx 18 enables using plugins to infer targets by default
      # This is disabled for existing workspaces to maintain compatibility
      # For more info, see: https://nx.dev/concepts/inferred-tasks
      NX_ADD_PLUGINS=false"
    `);
  });
});
