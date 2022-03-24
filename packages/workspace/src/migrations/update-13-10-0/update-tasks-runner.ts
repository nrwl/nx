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
      '@nrwl/workspace/tasks-runner/default'
  ) {
    config.tasksRunnerOptions['default'].runner = 'nx/tasks-runner/default';
  }
  updateWorkspaceConfiguration(host, config);
}

export default updateTasksRunner;
