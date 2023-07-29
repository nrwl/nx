import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';
import { Builders } from '@schematics/angular/utility/workspace-models';

export default async function updateWorkspaceConfigurations(tree: Tree) {
  const projects = getProjects(tree);

  const supportedExecutors: Set<string> = new Set([Builders.Server]);
  for (const [name, project] of projects) {
    for (const [targetName, target] of Object.entries(project.targets || {})) {
      if (!supportedExecutors.has(target.executor)) {
        continue;
      }

      target.options.bundleDependencies = undefined;

      for (const [configurationName, configuration] of Object.entries(
        target.configurations || {}
      )) {
        configuration.bundleDependencies = undefined;
        target[configurationName] = configuration;
      }

      project.targets[targetName] = target;
      updateProjectConfiguration(tree, name, project);
    }
  }

  await formatFiles(tree);
}
