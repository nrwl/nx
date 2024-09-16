import { getCloudUrl, isNxCloudId } from './get-cloud-options';

export async function isWorkspaceClaimed(accessToken: string) {
  if (!accessToken) return false;

  const apiUrl = getCloudUrl();
  try {
    const requestData = isNxCloudId(accessToken)
      ? { nxCloudId: accessToken }
      : { nxCloudAccessToken: accessToken };
    const response = await require('axios').post(
      `${apiUrl}/nx-cloud/is-workspace-claimed`,
      requestData
    );

    if (response.data.message) {
      return false;
    } else {
      return response.data;
    }
  } catch (e) {
    // We want to handle cases the if the request fails for any reason
    return false;
  }
}
