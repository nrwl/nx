import {
  Tree,
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { NxPluginE2EExecutorOptions } from '../../executors/e2e/schema';

export default async function replaceE2EExecutor(tree: Tree): Promise<void> {
  const projects = getProjects(tree);
  for (const executor of ['@nx/plugin:e2e', '@nrwl/nx-plugin:e2e']) {
    forEachExecutorOptions<NxPluginE2EExecutorOptions>(
      tree,
      executor,
      (options, project, target, configuration) => {
        const projectConfiguration = projects.get(project);

        const config = {
          ...options,
          target: undefined,
          runInBand: true,
        };
        if (configuration) {
          projectConfiguration.targets[target].configurations[configuration] =
            config;
        } else {
          projectConfiguration.targets[target].dependsOn = [
            ...(projectConfiguration.targets[target].dependsOn ?? []),
            options.target,
          ];
          projectConfiguration.targets[target].executor = '@nx/jest:jest';
          projectConfiguration.targets[target].options = config;
        }

        updateProjectConfiguration(tree, project, projectConfiguration);
      }
    );
  }

  await formatFiles(tree);
}
