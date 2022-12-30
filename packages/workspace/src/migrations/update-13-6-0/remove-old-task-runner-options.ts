import {
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export function removeOldTaskRunnerOptions(host: Tree) {
  const workspaceConfig = readWorkspaceConfiguration(host);
  const options = workspaceConfig.tasksRunnerOptions?.['default']?.options;
  if (options) {
    delete options.scan;
    delete options.analytics;
    updateWorkspaceConfiguration(host, workspaceConfig);
  }
}

export default removeOldTaskRunnerOptions;
