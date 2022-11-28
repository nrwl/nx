import { readNxJson } from '../config/configuration';

export function isNxCloudUsed() {
  const nxConfig = readNxJson();
  return Object.values(nxConfig.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
}
