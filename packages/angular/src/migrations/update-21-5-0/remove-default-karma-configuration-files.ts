import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
  type Tree,
} from '@nx/devkit';
import { allProjectTargets, allTargetOptions } from '../../utils/targets';
import { analyzeKarmaConfig } from './utils/karma-config-analyzer';
import {
  compareKarmaConfigToDefault,
  hasDifferences,
} from './utils/karma-config-comparer';

export default async function (tree: Tree) {
  const removableKarmaConfigs = new Map<string, boolean>();

  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    for (const [, target] of allProjectTargets(project)) {
      let needDevkitPlugin = false;
      switch (target.executor) {
        case '@angular-devkit/build-angular:karma':
          needDevkitPlugin = true;
          break;
        case '@angular/build:karma':
          break;
        default:
          continue;
      }

      for (const [, options] of allTargetOptions<{
        karmaConfig?: string | unknown;
      }>(target)) {
        const karmaConfig = options['karmaConfig'];
        if (typeof karmaConfig !== 'string') {
          continue;
        }

        let isRemovable = removableKarmaConfigs.get(karmaConfig);
        if (isRemovable === undefined && tree.exists(karmaConfig)) {
          const content = tree.read(karmaConfig, 'utf-8');
          const analysis = analyzeKarmaConfig(content);

          if (analysis.hasUnsupportedValues) {
            // Cannot safely determine if the file is removable.
            isRemovable = false;
          } else {
            const diff = await compareKarmaConfigToDefault(
              analysis,
              projectName,
              karmaConfig,
              needDevkitPlugin
            );
            isRemovable = !hasDifferences(diff) && diff.isReliable;
          }

          removableKarmaConfigs.set(karmaConfig, isRemovable);

          if (isRemovable) {
            tree.delete(karmaConfig);
          }
        }

        if (isRemovable) {
          delete options['karmaConfig'];
          updateProjectConfiguration(tree, projectName, project);
        }
      }
    }
  }

  await formatFiles(tree);
}
