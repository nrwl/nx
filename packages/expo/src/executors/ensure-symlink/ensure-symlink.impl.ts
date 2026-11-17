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
  _,
  context: ExecutorContext
): AsyncGenerator<ExpoEnsureSymlinkOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  ensureNodeModulesSymlink(context.root, projectRoot);

  yield { success: true };
}
