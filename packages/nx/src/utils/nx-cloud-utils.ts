import { NxJsonConfiguration, readNxJson } from '../config/nx-json';

export function isNxCloudUsed(nxJson: NxJsonConfiguration) {
  return (
    !!nxJson.nxCloudAccessToken ||
    Object.values(nxJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
    )
  );
}

export function getNxCloudUrl(): string {
  const taskRunner = isNxCloudUsed(readNxJson());
  if (!taskRunner) throw new Error('nx-cloud runner not find in nx.json');
  return (
    (typeof taskRunner === 'object' ? taskRunner.options.url : null) ??
    'https://nx.app'
  );
}
export function getNxCloudToken(): string {
  const nxJson = readNxJson();
  const taskRunner = isNxCloudUsed(nxJson);

  if (!taskRunner) throw new Error('nx-cloud runner not find in nx.json');

  return typeof taskRunner === 'object'
    ? taskRunner.options.accessToken
    : nxJson.nxCloudAccessToken;
}
