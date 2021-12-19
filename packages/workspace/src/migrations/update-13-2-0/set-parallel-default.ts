import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export async function setParallelDefault(host: Tree) {
  const config = readWorkspaceConfiguration(host);
  const defaultTaskRunnerOptions =
    config.tasksRunnerOptions?.['default']?.options;
  if (defaultTaskRunnerOptions) {
    if (defaultTaskRunnerOptions.parallel) {
      defaultTaskRunnerOptions.parallel =
        defaultTaskRunnerOptions.maxParallel || 3;
      delete defaultTaskRunnerOptions.maxParallel;
    } else {
      defaultTaskRunnerOptions.parallel = 1;
    }
    updateWorkspaceConfiguration(host, config);
  }
  await formatFiles(host);
}

export default setParallelDefault;
