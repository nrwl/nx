import { formatFiles, getProjects, Tree } from '@nx/devkit';
import { addBabelInputs } from '@nx/js/src/utils/add-babel-inputs';

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
    addBabelInputs(tree);
  }

  await formatFiles(tree);
}
