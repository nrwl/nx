import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { allTargetOptions } from '../../utils/targets';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    let isUpdated = false;

    for (const target of Object.values(project.targets ?? {})) {
      if (target.executor !== '@nx/angular:application') {
        continue;
      }

      for (const [, options] of allTargetOptions<{
        ssr?:
          | boolean
          | { experimentalPlatform?: 'node' | 'neutral'; platform?: string };
      }>(target)) {
        const ssr = options.ssr;
        if (
          !ssr ||
          typeof ssr !== 'object' ||
          ssr.experimentalPlatform === undefined
        ) {
          continue;
        }

        ssr.platform ??= ssr.experimentalPlatform;
        delete ssr.experimentalPlatform;
        isUpdated = true;
      }
    }

    if (isUpdated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
