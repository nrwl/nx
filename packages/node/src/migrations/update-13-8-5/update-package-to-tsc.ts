import {
  addDependenciesToPackageJson,
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { nxVersion } from '@nx/workspace/src/utils/versions';

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

      if (
        projectConfiguration.targets[targetName].options
          ?.srcRootForCompilationRoot
      ) {
        projectConfiguration.targets[targetName].options.rootDir =
          projectConfiguration.targets[
            targetName
          ].options.srcRootForCompilationRoot;
        delete projectConfiguration.targets[targetName].options
          .srcRootForCompilationRoot;
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
