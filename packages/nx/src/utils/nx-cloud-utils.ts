import { readNxJson } from '../config/configuration';

export function isNxCloudUsed(nxJson = readNxJson()) {
  return (
    !!nxJson.accessToken ||
    Object.values(nxJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
    )
  );
}

export function getNxCloudUrl(): string {
  const taskRunner = isNxCloudUsed();
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
    : nxJson.accessToken;
}
