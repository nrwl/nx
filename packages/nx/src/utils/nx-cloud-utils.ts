import { readNxJson } from '../config/configuration';

export function isNxCloudUsed() {
  const nxJson = readNxJson();
  return Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
}
