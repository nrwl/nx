import { getProjects, Tree, updateProjectConfiguration } from '@nx/devkit';

export function updateRollupExecutor(tree: Tree) {
  const projects = getProjects(tree);

  for (const [name, project] of projects) {
    if (project.targets?.build?.executor === '@nrwl/web:rollup') {
      project.targets.build.executor = '@nrwl/rollup:rollup';
      updateProjectConfiguration(tree, name, project);
    }
  }
}

export default updateRollupExecutor;
