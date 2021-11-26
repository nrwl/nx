import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.build?.executor !== '@nrwl/web:package') return;

    config.targets.build.executor = '@nrwl/web:rollup';

    updateProjectConfiguration(host, name, config);
  }

  await formatFiles(host);
}
