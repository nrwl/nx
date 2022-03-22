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
    if (config?.targets?.serve?.executor !== '@nrwl/js:node') continue;

    config.targets.serve.executor = '@nrwl/node:node';

    installNeeded = true;
    updateProjectConfiguration(host, name, config);
  }

  const task = installNeeded
    ? addDependenciesToPackageJson(
        host,
        {},
        {
          '@nrwl/node': nxVersion,
        }
      )
    : undefined;

  await formatFiles(host);

  return task;
}
