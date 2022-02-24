import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { nxVersion } from '@nrwl/workspace/src/utils/versions';

export default async function update(host: Tree) {
  const projects = getProjects(host);
  let installNeeded = false;

  for (const [name, config] of projects.entries()) {
    if (config?.targets?.build?.executor !== '@nrwl/node:package') continue;

    config.targets.build.executor = '@nrwl/js:tsc';

    const transformers = config.targets.build.options?.tsPlugins;
    if (transformers) {
      delete config.targets.build.options.tsPlugins;
      config.targets.build.options.transformers = transformers;
    }

    installNeeded = true;
    updateProjectConfiguration(host, name, config);
  }

  const task = installNeeded
    ? addDependenciesToPackageJson(
        host,
        {},
        {
          '@nrwl/js': nxVersion,
        }
      )
    : undefined;

  await formatFiles(host);

  return task;
}
