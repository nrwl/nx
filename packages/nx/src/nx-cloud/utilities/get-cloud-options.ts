import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
import { readNxJson } from '../../config/nx-json';
import { getRunnerOptions } from '../../tasks-runner/run-command';

export function getCloudOptions(
  taskRunnerConfiguration: string
): CloudTaskRunnerOptions {
  const nxJson = readNxJson();

  return getRunnerOptions(taskRunnerConfiguration, nxJson, {});
}
