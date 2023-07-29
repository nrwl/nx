import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

export default async function update(host: Tree) {
  const projects = getProjects(host);

  for (const [name, config] of projects.entries()) {
    let updated = false;
    if (config?.targets?.build?.executor === '@nrwl/web:webpack') {
      config.targets.build.executor = '@nrwl/webpack:webpack';
      updated = true;
    }
    if (config?.targets?.serve?.executor === '@nrwl/web:dev-server') {
      config.targets.serve.executor = '@nrwl/webpack:dev-server';
      updated = true;
    }
    if (updated) {
      updateProjectConfiguration(host, name, config);
    }
  }

  await formatFiles(host);
}
