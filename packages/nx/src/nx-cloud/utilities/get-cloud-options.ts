import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
import { readNxJson } from '../../config/nx-json';
import { getRunnerOptions } from '../../tasks-runner/run-command';
import { workspaceRoot } from '../../utils/workspace-root';

export function getCloudOptions(
  directory = workspaceRoot
): CloudTaskRunnerOptions {
  const nxJson = readNxJson(directory);

  // TODO: The default is not always cloud? But it's not handled at the moment
  return getRunnerOptions('default', nxJson, {}, true);
}

export function getCloudUrl() {
  return removeTrailingSlash(
    process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
  );
}

export function removeTrailingSlash(apiUrl: string) {
  return apiUrl[apiUrl.length - 1] === '/' ? apiUrl.slice(0, -1) : apiUrl;
}

export function isNxCloudId(token: string): boolean {
  return token.length === 24;
}
