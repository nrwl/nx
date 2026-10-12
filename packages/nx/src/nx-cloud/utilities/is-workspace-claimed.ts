import { getCloudUrl, isNxCloudId } from './get-cloud-options';
import { httpRequest } from '../../utils/http-client';

export async function isWorkspaceClaimed(accessToken: string) {
  if (!accessToken) return false;

  const apiUrl = getCloudUrl();
  try {
    const requestData = isNxCloudId(accessToken)
      ? { nxCloudId: accessToken }
      : { nxCloudAccessToken: accessToken };
    const response = await httpRequest(
      `${apiUrl}/nx-cloud/is-workspace-claimed`,
      { method: 'POST', data: requestData }
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
