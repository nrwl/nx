import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

const executors = new Set(['@nx/rollup:rollup', '@nrwl/rollup:rollup']);

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    if (project.projectType !== 'library') {
      continue;
    }

    let updated = false;
    for (const [, target] of Object.entries(project.targets || {})) {
      if (!executors.has(target.executor)) {
        continue;
      }

      if (
        target.options &&
        target.options.updateBuildableProjectDepsInPackageJson === undefined
      ) {
        target.options.updateBuildableProjectDepsInPackageJson = true;
        updated = true;
      }
    }

    if (updated) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
