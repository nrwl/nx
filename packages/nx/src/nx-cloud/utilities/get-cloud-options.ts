import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
import { readNxJson } from '../../config/nx-json';
import { getRunnerOptions } from '../../tasks-runner/run-command';

export function getCloudOptions(): CloudTaskRunnerOptions {
  const nxJson = readNxJson();

  // TODO: The default is not always cloud? But it's not handled at the moment
  return getRunnerOptions('default', nxJson, {}, true);
}
