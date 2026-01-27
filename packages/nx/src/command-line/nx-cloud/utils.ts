import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { handleErrors } from '../../utils/handle-errors';
import { findAncestorNodeModules } from '../../nx-cloud/resolution-helpers';
import { output } from '../../utils/output';

export function warnNotConnectedToCloud(): void {
  output.warn({
    title: 'Nx Cloud is not enabled',
    bodyLines: [
      'This command requires a connection to the full Nx platform.',
      'Run `nx connect` to connect your workspace.',
    ],
  });
}

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
