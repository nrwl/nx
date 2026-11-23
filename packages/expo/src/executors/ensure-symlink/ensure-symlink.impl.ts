import { ExecutorContext } from '@nx/devkit';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

export interface ExpoEnsureSymlinkOutput {
  success: boolean;
}

/**
 * TODO(v25): decide whether to remove this executor (NXC-5159).
 * @deprecated It is no longer needed for react native 73.
 */
export default async function* ensureSymlinkExecutor(
  _: unknown,
  context: ExecutorContext
): AsyncGenerator<ExpoEnsureSymlinkOutput> {
  const { projectName } = context;
  if (!projectName) {
    throw new Error('The ensure-symlink executor requires a project name.');
  }
  const projectRoot = context.projectsConfigurations.projects[projectName].root;

  ensureNodeModulesSymlink(context.root, projectRoot);

  yield { success: true };
}
