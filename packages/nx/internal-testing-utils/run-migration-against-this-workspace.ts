import { FsTree, Tree } from '../src/generators/tree';
import { join } from 'path';

export function assertRunsAgainstNxRepo(
  migrateFn: (tree: Tree) => void | Promise<void>
) {
  it('should run against the Nx repo', async () => {
    const tree = new FsTree(join(__dirname, '../../../'), true);
    let resultOrPromise: void | Promise<void> = migrateFn(tree);

    if (resultOrPromise && 'then' in resultOrPromise) {
      try {
        await resultOrPromise;
      } catch (e) {
        fail(e);
      }
    }
  });
}
