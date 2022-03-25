import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { nxVersion } from '@nrwl/workspace/src/utils/versions';

export default async function update(host: Tree) {
  let installNeeded = false;

  forEachExecutorOptions(
    host,
    '@nrwl/node:package',
    (_, projectName, targetName) => {
      installNeeded = true;
      const projectConfiguration = readProjectConfiguration(host, projectName);

      projectConfiguration.targets[targetName].executor = '@nrwl/js:tsc';

      const transformers =
        projectConfiguration.targets[targetName].options?.tsPlugins;
      if (transformers) {
        delete projectConfiguration.targets[targetName].options.tsPlugins;
        projectConfiguration.targets[targetName].options.transformers =
          transformers;
      }

      updateProjectConfiguration(host, projectName, projectConfiguration);
    }
  );

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
