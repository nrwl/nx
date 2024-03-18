import { ExecutorContext } from '@nx/devkit';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

export interface ReactNativeEnsureSymlinkOutput {
  success: boolean;
}

/**
 * TODO (@xiongemi): remove this function in v19.
 * @deprecated It is no longer needed for react native 73.
 */
export default async function* ensureSymlinkExecutor(
  _,
  context: ExecutorContext
): AsyncGenerator<ReactNativeEnsureSymlinkOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;

  ensureNodeModulesSymlink(context.root, projectRoot);

  yield { success: true };
}
