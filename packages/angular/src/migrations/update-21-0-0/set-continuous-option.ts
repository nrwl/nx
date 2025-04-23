import {
  formatFiles,
  getProjects,
  type Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export const continuousExecutors = new Set([
  '@angular-devkit/build-angular:dev-server',
  '@angular-devkit/build-angular:ssr-dev-server',
  '@nx/angular:dev-server',
  '@nx/angular:module-federation-dev-server',
  '@nx/angular:module-federation-dev-ssr',
]);

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    let updated = false;

    for (const targetConfig of Object.values(projectConfig.targets ?? {})) {
      if (
        continuousExecutors.has(targetConfig.executor) &&
        targetConfig.continuous === undefined
      ) {
        targetConfig.continuous = true;
        updated = true;
      }
    }

    if (updated) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  }

  await formatFiles(tree);
}
