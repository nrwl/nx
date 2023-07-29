import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';

export async function setParallelDefault(host: Tree) {
  const config = readNxJson(host);
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
    updateNxJson(host, config);
  }
  await formatFiles(host);
}

export default setParallelDefault;
