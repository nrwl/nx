import { readNxJson, Tree, updateNxJson } from '@nx/devkit';

export function removeOldTaskRunnerOptions(host: Tree) {
  const nxJson = readNxJson(host);
  const options = nxJson.tasksRunnerOptions?.['default']?.options;
  if (options) {
    delete options.scan;
    delete options.analytics;
    updateNxJson(host, nxJson);
  }
}

export default removeOldTaskRunnerOptions;
