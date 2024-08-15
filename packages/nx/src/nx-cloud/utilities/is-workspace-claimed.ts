import { getCloudUrl } from './get-cloud-options';

export async function isWorkspaceClaimed(nxCloudAccessToken) {
  if (!nxCloudAccessToken) return false;

  const apiUrl = getCloudUrl();
  try {
    const response = await require('axios').post(
      `${apiUrl}/nx-cloud/is-workspace-claimed`,
      {
        nxCloudAccessToken,
      }
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
