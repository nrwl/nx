import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, project] of projects) {
    if (!project.targets) {
      continue;
    }

    let shouldUpdate = false;
    Object.values(project.targets).forEach((target) => {
      if (target.executor === '@nrwl/angular:webpack-browser') {
        shouldUpdate = true;
        target.options = { ...target.options, buildLibsFromSource: false };
      }
    });

    if (shouldUpdate) {
      updateProjectConfiguration(tree, projectName, project);
    }
  }

  await formatFiles(tree);
}
