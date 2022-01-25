import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export function removeOldTaskRunnerOptions(host: Tree) {
  const workspaceConfig = readWorkspaceConfiguration(host);
  if (workspaceConfig.tasksRunnerOptions['default']) {
    const options = workspaceConfig.tasksRunnerOptions['default'].options;
    delete options.scan;
    delete options.analytics;
    updateWorkspaceConfiguration(host, workspaceConfig);
  }
}

export default removeOldTaskRunnerOptions;
