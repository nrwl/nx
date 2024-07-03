import { NxJsonConfiguration, readNxJson } from '../config/nx-json';

export function isNxCloudUsed(nxJson: NxJsonConfiguration): boolean {
  return (
    !!process.env.NX_CLOUD_ACCESS_TOKEN ||
    !!nxJson.nxCloudAccessToken ||
    !!Object.values(nxJson.tasksRunnerOptions ?? {}).find(
      (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
    )
  );
}

export function getNxCloudUrl(nxJson: NxJsonConfiguration): string {
  const cloudRunner = Object.values(nxJson.tasksRunnerOptions ?? {}).find(
    (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
  );
  if (
    !cloudRunner &&
    !(nxJson.nxCloudAccessToken || process.env.NX_CLOUD_ACCESS_TOKEN)
  )
    throw new Error('nx-cloud runner not found in nx.json');
  return cloudRunner?.options?.url ?? nxJson.nxCloudUrl ?? 'https://nx.app';
}

export function getNxCloudToken(nxJson: NxJsonConfiguration): string {
  const cloudRunner = Object.values(nxJson.tasksRunnerOptions ?? {}).find(
    (r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'
  );

  if (
    !cloudRunner &&
    !(nxJson.nxCloudAccessToken || process.env.NX_CLOUD_ACCESS_TOKEN)
  )
    throw new Error('nx-cloud runner not found in nx.json');

  return (
    process.env.NX_CLOUD_ACCESS_TOKEN ??
    cloudRunner?.options.accessToken ??
    nxJson.nxCloudAccessToken
  );
}
