import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

export function updateTasksRunner(host: Tree) {
  const config = readNxJson(host);
  if (
    config?.tasksRunnerOptions?.['default'] &&
    config?.tasksRunnerOptions['default'].runner ==
      '@nrwl/workspace/tasks-runners/default'
  ) {
    config.tasksRunnerOptions['default'].runner = 'nx/tasks-runners/default';
  }
  updateNxJson(host, config);
}

export default updateTasksRunner;
