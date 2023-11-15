import { ExecutorContext, joinPathFragments } from '@nx/devkit';
import { NuxtBuildExecutorOptions } from './schema';
import {
  getCommonNuxtConfigOverrides,
  loadNuxiDynamicImport,
  loadNuxtKitDynamicImport,
} from '../../utils/executor-utils';

export async function* nuxtBuildExecutor(
  options: NuxtBuildExecutorOptions,
  context: ExecutorContext
) {
  const projectRoot =
    context.projectsConfigurations.projects[context.projectName].root;
  const { runCommand } = await loadNuxiDynamicImport();
  const { loadNuxtConfig } = await loadNuxtKitDynamicImport();
  const config = await loadNuxtConfig({
    cwd: joinPathFragments(context.root, projectRoot),
  });

  try {
    await runCommand('build', [projectRoot], {
      overrides: {
        ...options,
        ...getCommonNuxtConfigOverrides(
          config,
          context.root,
          projectRoot,
          options.outputPath
        ),
      },
    });
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: e };
  }
}

export default nuxtBuildExecutor;
