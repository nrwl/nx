import { readNxJson } from '../config/configuration';

export function isNxCloudUsed() {
  const nxJson = readNxJson();
  return Object.values(nxJson.tasksRunnerOptions).find(
    (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
  );
}

export function getNxCloudUrl(): string {
  const taskRunner = isNxCloudUsed();
  if (!taskRunner) throw new Error('nx-cloud runner not find in nx.json');
  return taskRunner.options.url || 'https://nx.app';
}
export function getNxCloudToken(): string {
  const taskRunner = isNxCloudUsed();
  if (!taskRunner) throw new Error('nx-cloud runner not find in nx.json');
  return taskRunner.options.accessToken;
}
