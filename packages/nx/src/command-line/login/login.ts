import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { handleErrors } from '../../utils/params';

export interface LoginArgs {
  nxCloudUrl?: string;
  verbose?: boolean;
}

export function loginHandler(args: LoginArgs): Promise<number> {
  if (args.nxCloudUrl) {
    process.env.NX_CLOUD_API = args.nxCloudUrl;
  }

  return handleErrors(
    (args.verbose as boolean) ?? process.env.NX_VERBOSE_LOGGING === 'true',
    async () => {
      const nxCloudClient = (
        await verifyOrUpdateNxCloudClient(getCloudOptions())
      ).nxCloudClient;
      await nxCloudClient.commands.login();
    }
  );
}
