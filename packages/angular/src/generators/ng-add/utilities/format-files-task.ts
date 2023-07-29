import type { Tree } from '@nx/devkit';
import { getPackageManagerCommand } from '@nx/devkit';
import { runNxSync } from 'nx/src/utils/child-process';

export function formatFilesTask(tree: Tree): void {
  if (
    !tree
      .listChanges()
      .some((change) => change.type === 'CREATE' || change.type === 'UPDATE')
  ) {
    return;
  }

  try {
    runNxSync(`format`, { cwd: tree.root, stdio: [0, 1, 2] });
  } catch {}
}
