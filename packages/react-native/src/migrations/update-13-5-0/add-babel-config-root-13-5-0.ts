import { getProjects, Tree } from '@nrwl/devkit';

import { initRootBabelConfig } from '../../generators/init/lib/init-root-babel-config';

export default async function update(tree: Tree) {
  const projects = getProjects(tree);

  if (tree.exists('/babel.config.json') || tree.exists('/babel.config.js')) {
    return;
  }

  let hasReactNaiveProject = false;
  projects.forEach((project) => {
    if (hasReactNaiveProject) return;
    hasReactNaiveProject =
      project.targets?.start?.executor === '@nrwl/react-native:start';
  });

  if (hasReactNaiveProject) {
    initRootBabelConfig(tree);
  }
}
