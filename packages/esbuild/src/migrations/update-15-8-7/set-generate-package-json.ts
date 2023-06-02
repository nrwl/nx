import type { Tree } from '@nx/devkit';
import {
  formatFiles,
  getProjects,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(tree: Tree): Promise<void> {
  const projects = getProjects(tree);

  projects.forEach((projectConfig, projectName) => {
    let shouldUpdate = false;

    Object.entries(projectConfig.targets).forEach(
      ([targetName, targetConfig]) => {
        if (targetConfig.executor === '@nrwl/esbuild:esbuild') {
          shouldUpdate = true;

          projectConfig.targets[targetName].options ??= {};
          projectConfig.targets[targetName].options.generatePackageJson ??=
            true;
        }
      }
    );

    if (shouldUpdate) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  });

  await formatFiles(tree);
}
