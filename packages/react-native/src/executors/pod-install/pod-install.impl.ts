import { join } from 'path';
import { ExecutorContext } from '@nx/devkit';

import { runPodInstall } from '../../utils/pod-install-task';
import { ReactNativePodInstallOptions } from './schema';

export interface ReactNativePodInstallOutput {
  success: boolean;
}

export default async function* podInstall(
  options: ReactNativePodInstallOptions,
  context: ExecutorContext
): AsyncGenerator<ReactNativePodInstallOutput> {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const iosDirectory = join(context.root, projectRoot, 'ios');
  await runPodInstall(iosDirectory, true, options.buildFolder)();

  yield { success: true };
}
