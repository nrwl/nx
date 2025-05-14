import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { handleErrors } from '../../utils/handle-errors';
import { findAncestorNodeModules } from '../../nx-cloud/resolution-helpers';

export interface LogoutArgs {
  verbose?: boolean;
}

export function logoutHandler(args: LogoutArgs): Promise<number> {
  return handleErrors(args.verbose, async () => {
    const nxCloudClient = (await verifyOrUpdateNxCloudClient(getCloudOptions()))
      .nxCloudClient;

    const paths = findAncestorNodeModules(__dirname, []);
    nxCloudClient.configureLightClientRequire()(paths);

    await nxCloudClient.commands.logout();
  });
}
