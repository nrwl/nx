import { execSync } from 'child_process';

/*
 * Because we don't want to depend on @nrwl/workspace (to speed up the workspace creation)
 * we duplicate the helper functions from @nrwl/workspace in this file.
 */
export function deduceDefaultBase(): string {
  const nxDefaultBase = 'main';
  try {
    return (
      execSync('git config --get init.defaultBranch').toString().trim() ||
      nxDefaultBase
    );
  } catch {
    return nxDefaultBase;
  }
}
