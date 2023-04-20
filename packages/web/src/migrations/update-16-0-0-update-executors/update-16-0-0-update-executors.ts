import {
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
  addDependenciesToPackageJson,
} from '@nx/devkit';
import { nxVersion } from '../../utils/versions';

export default async function update(host: Tree) {
  const projects = getProjects(host);
  const deps = {};

  for (const [name, config] of projects.entries()) {
    let updated = false;

    // webpack
    if (config?.targets?.build?.executor === '@nrwl/web:webpack') {
      config.targets.build.executor = '@nx/webpack:webpack';
      deps['@nx/webpack'] = nxVersion;
      updated = true;
    }
    if (config?.targets?.serve?.executor === '@nrwl/web:dev-server') {
      config.targets.serve.executor = '@nx/webpack:dev-server';
      deps['@nx/webpack'] = nxVersion;
      updated = true;
    }

    // rollup
    if (config?.targets?.build?.executor === '@nrwl/web:rollup') {
      config.targets.build.executor = '@nx/rollup:rollup';
      deps['@nx/rollup'] = nxVersion;
      updated = true;
    }

    if (updated) {
      updateProjectConfiguration(host, name, config);
    }
  }

  await formatFiles(host);

  return addDependenciesToPackageJson(host, {}, deps);
}
