import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

/**
 * Removes deprecated
 * @param tree
 */
export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    let shouldUpdate = false;

    if (!projectConfig.targets) continue;

    for (const target of Object.values(projectConfig.targets)) {
      if (
        target.executor?.startsWith('@nx/') &&
        target.options &&
        ('buildableProjectDepsInPackageJsonType' in target.options ||
          'updateBuildableProjectDepsInPackageJson' in target.options)
      ) {
        delete target.options['buildableProjectDepsInPackageJsonType'];
        delete target.options['updateBuildableProjectDepsInPackageJson'];
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  }

  await formatFiles(tree);
}
