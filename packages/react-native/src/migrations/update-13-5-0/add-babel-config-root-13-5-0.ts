import { getProjects, Tree } from '@nrwl/devkit';

import { initRootBabelConfig } from '../../generators/init/lib/init-root-babel-config';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  const hasReactNaiveProject = Array.from(projects)
    .map(([_, project]) => project)
    .some(
      (project) =>
        project.targets?.start?.executor === '@nrwl/react-native:start'
    );

  if (hasReactNaiveProject) {
    initRootBabelConfig(tree);
  }
}
