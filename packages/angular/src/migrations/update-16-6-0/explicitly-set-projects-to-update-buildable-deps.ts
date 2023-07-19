import {
  createProjectGraphAsync,
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

const executors = new Set([
  '@nx/angular:ng-packagr-lite',
  '@nrwl/angular:ng-packagr-lite',
  '@nx/angular:package',
  '@nrwl/angular:package',
]);

export default async function (tree: Tree) {
  // use project graph to get the expanded target configurations
  const projectGraph = await createProjectGraphAsync();

  for (const [projectName, { data: projectData }] of Object.entries(
    projectGraph.nodes
  )) {
    if (projectData.projectType !== 'library') {
      continue;
    }

    for (const [targetName, target] of Object.entries(
      projectData.targets || {}
    )) {
      if (!executors.has(target.executor)) {
        continue;
      }

      if (
        !target.options ||
        target.options.updateBuildableProjectDepsInPackageJson === undefined
      ) {
        // read the project configuration to write the explicit project configuration
        // and avoid writing the expanded target configuration
        const project = readProjectConfiguration(tree, projectName);
        project.targets[targetName].options ??= {};
        project.targets[
          targetName
        ].options.updateBuildableProjectDepsInPackageJson = true;
        updateProjectConfiguration(tree, projectName, project);
      }
    }
  }

  await formatFiles(tree);
}
