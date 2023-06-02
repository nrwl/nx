import { ExecutorContext } from '@nx/devkit';

import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

export interface ExpoEnsureSymlinkOutput {
  success: boolean;
}

export default async function* ensureSymlinkExecutor(
  _,
  context: ExecutorContext
): AsyncGenerator<ExpoEnsureSymlinkOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  ensureNodeModulesSymlink(context.root, projectRoot);

  yield { success: true };
}
