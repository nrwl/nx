import type { Tree } from '@nx/devkit';
import { getProjects, updateProjectConfiguration } from '@nx/devkit';

export default function renameWebpackServer(tree: Tree) {
  const projects = getProjects(tree);

  const oldExecutorName = '@nrwl/angular:webpack-server';
  const newExecutorName = '@nrwl/angular:webpack-dev-server';

  for (const [projectName, project] of projects.entries()) {
    let stringifiedProject = JSON.stringify(project);
    if (!stringifiedProject.includes(oldExecutorName)) {
      continue;
    }
    for (const [targetName, target] of Object.entries(project.targets)) {
      if (target.executor === oldExecutorName) {
        target.executor = newExecutorName;
      }
    }

    updateProjectConfiguration(tree, projectName, project);
  }
}
