import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.serve?.executor !== '@nrwl/node:execute') continue;

    config.targets.serve.executor = '@nrwl/node:node';

    updateProjectConfiguration(host, name, config);
  }

  await formatFiles(host);
}
