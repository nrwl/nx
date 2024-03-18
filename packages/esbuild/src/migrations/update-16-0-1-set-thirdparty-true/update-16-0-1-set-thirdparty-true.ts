/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((projectConfig, projectName) => {
    if (!projectConfig.targets) return;

    let shouldUpdate = false;

    Object.entries(projectConfig.targets).forEach(
      ([targetName, targetConfig]) => {
        if (
          targetConfig.executor === '@nrwl/esbuild:esbuild' ||
          targetConfig.executor === '@nx/esbuild:esbuild'
        ) {
          projectConfig.targets[targetName].options ??= {};
          if (projectConfig.targets[targetName].options.bundle !== false) {
            shouldUpdate = true;

            projectConfig.targets[targetName].options.thirdParty ??= true;
          }
        }
      }
    );

    if (shouldUpdate) {
      updateProjectConfiguration(host, projectName, projectConfig);
    }
  });

  await formatFiles(host);
}
