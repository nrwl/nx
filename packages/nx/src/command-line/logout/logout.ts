import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { handleErrors } from '../../utils/params';

export interface LogoutArgs {
  verbose?: boolean;
}

export function logoutHandler(args: LogoutArgs): Promise<number> {
  return handleErrors(
    (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
    async () => {
      const nxCloudClient = (
        await verifyOrUpdateNxCloudClient(getCloudOptions())
      ).nxCloudClient;
      await nxCloudClient.commands.logout();
    }
  );
}
