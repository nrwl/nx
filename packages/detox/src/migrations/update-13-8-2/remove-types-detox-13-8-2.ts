import { getProjects, readJson, Tree, updateJson } from '@nrwl/devkit';

export default async function update(tree: Tree) {
  const packageJson = readJson(tree, 'package.json');

  if (!packageJson.devDependencies['@types/detox']) {
    return;
  }

  const projects = getProjects(tree);
  const hasDetoxProject = Array.from(projects)
    .map(([_, project]) => project)
    .some(
      (project) =>
        project.targets?.['test-ios']?.executor === '@nrwl/detox:test'
    );

  if (!hasDetoxProject) {
    return;
  }

  updateJson(tree, 'package.json', (packageJson) => {
    delete packageJson.devDependencies['@types/detox'];
    return packageJson;
  });
}
