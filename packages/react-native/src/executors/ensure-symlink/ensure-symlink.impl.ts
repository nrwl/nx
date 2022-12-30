import { ExecutorContext } from '@nrwl/devkit';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';

export interface ReactNativeEnsureSymlinkOutput {
  success: boolean;
}

export default async function* ensureSymlinkExecutor(
  _,
  context: ExecutorContext
): AsyncGenerator<ReactNativeEnsureSymlinkOutput> {
  const projectRoot = context.workspace.projects[context.projectName].root;

  ensureNodeModulesSymlink(context.root, projectRoot);

  yield { success: true };
}
