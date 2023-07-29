import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  NX_VERSION,
  readNxJson,
  Tree,
} from '@nx/devkit';

export default async function addDroppedDependencies(tree: Tree) {
  const devDependencies = {};
  const droppedDependencies = [
    '@nrwl/linter',
    '@nrwl/cypress',
    '@nrwl/jest',
    '@nrwl/rollup',
  ];
  const projects = getProjects(tree);

  for (const [_, projectConfiguration] of projects) {
    for (const [_, targetConfiguration] of Object.entries(
      projectConfiguration.targets ?? {}
    )) {
      for (const droppedDependency of droppedDependencies) {
        if (targetConfiguration.executor?.startsWith(droppedDependency + ':')) {
          devDependencies[droppedDependency] = NX_VERSION;
        }
      }
    }
  }

  const nxJson = readNxJson(tree);

  for (const [_, targetConfiguration] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    for (const droppedDependency of droppedDependencies) {
      if (targetConfiguration.executor?.startsWith(droppedDependency + ':')) {
        devDependencies[droppedDependency] = NX_VERSION;
      }
    }
  }

  if (Object.keys(devDependencies).length > 0) {
    addDependenciesToPackageJson(tree, {}, devDependencies);
  }

  await formatFiles(tree);
}
