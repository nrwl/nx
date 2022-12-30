import type { Tree } from '@nrwl/devkit';
import { getPackageManagerCommand } from '@nrwl/devkit';
import { execSync } from 'child_process';

export function formatFilesTask(tree: Tree): void {
  if (
    !tree
      .listChanges()
      .some((change) => change.type === 'CREATE' || change.type === 'UPDATE')
  ) {
    return;
  }

  const pmc = getPackageManagerCommand();
  try {
    execSync(`${pmc.exec} nx format`, { cwd: tree.root, stdio: [0, 1, 2] });
  } catch {}
}
