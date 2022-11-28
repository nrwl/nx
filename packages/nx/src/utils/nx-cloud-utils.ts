import { readNxConfig } from '../config/configuration';

export function isNxCloudUsed() {
  const nxConfig = readNxConfig();
  return Object.values(nxConfig.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud'
  );
}
