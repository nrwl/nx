import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager.js';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options.js';
import { handleErrors } from '../../utils/handle-errors.js';
import { findAncestorNodeModules } from '../../nx-cloud/resolution-helpers.js';

export async function executeNxCloudCommand(
  commandName: string,
  verbose?: boolean
): Promise<number> {
  return handleErrors(verbose, async () => {
    const nxCloudClient = (await verifyOrUpdateNxCloudClient(getCloudOptions()))
      .nxCloudClient;

    const paths = findAncestorNodeModules(__dirname, []);
    nxCloudClient.configureLightClientRequire()(paths);

    await nxCloudClient.commands[commandName]();
  });
}
