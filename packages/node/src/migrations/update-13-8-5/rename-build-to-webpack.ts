import {
  formatFiles,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export default async function update(host: Tree) {
  forEachExecutorOptions(
    host,
    '@nrwl/node:build',
    (_, projectName, targetName) => {
      const projectConfiguration = readProjectConfiguration(host, projectName);
      projectConfiguration.targets[targetName].executor = '@nrwl/node:webpack';
      updateProjectConfiguration(host, projectName, projectConfiguration);
    }
  );

  await formatFiles(host);
}
