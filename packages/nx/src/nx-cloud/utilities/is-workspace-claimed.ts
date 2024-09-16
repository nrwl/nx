import { getCloudUrl } from './get-cloud-options';

export async function isWorkspaceClaimed(
  token: string,
  tokenType: 'ciAccessToken' | 'nxCloudId'
) {
  if (!token) return false;

  const apiUrl = getCloudUrl();
  try {
    const requestData =
      tokenType === 'ciAccessToken'
        ? { nxCloudAccessToken: token }
        : { nxCloudId: token };
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
