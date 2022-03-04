import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.build?.executor !== '@nrwl/node:build') continue;

    config.targets.build.executor = '@nrwl/node:webpack';

    updateProjectConfiguration(host, name, config);
  }

  await formatFiles(host);
}
