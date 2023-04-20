import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.build?.executor === '@nrwl/node:webpack') {
      config.targets.build.executor = '@nx/webpack:webpack';
      config.targets.build.options.target = 'node';
      config.targets.build.options.compiler = 'tsc';
      updateProjectConfiguration(host, name, config);
    }
  }

  await formatFiles(host);
}
