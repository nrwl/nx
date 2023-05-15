import { workspaceRoot } from '../src/utils/workspace-root';
import { FsTree, Tree } from '../src/generators/tree';

export default async function runMigrationAgainstThisWorkspace(
  migrateFn: (tree: Tree) => void
) {
  const tree = new FsTree(workspaceRoot, true);
  expect(() => migrateFn(tree)).not.toThrow();
}
