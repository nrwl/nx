import {
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
  Tree,
} from '@nrwl/devkit';

export function updateTasksRunner(host: Tree) {
  const config = readWorkspaceConfiguration(host);
  if (
    config?.tasksRunnerOptions['default'] &&
    config?.tasksRunnerOptions['default'].runner ==
      '@nrwl/workspace/tasks-runners/default'
  ) {
    config.tasksRunnerOptions['default'].runner = 'nx/tasks-runners/default';
  }
  updateWorkspaceConfiguration(host, config);
}

export default updateTasksRunner;
