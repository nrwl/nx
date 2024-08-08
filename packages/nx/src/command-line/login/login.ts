import { verifyOrUpdateNxCloudClient } from '../../nx-cloud/update-manager';
import { getCloudOptions } from '../../nx-cloud/utilities/get-cloud-options';
import { handleErrors } from '../../utils/params';

export interface LoginOptions {
  nxCloudUrl?: string;
  verbose?: boolean;
}

export function loginHandler(options: LoginOptions): Promise<number> {
  if (options.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';

  return handleErrors(isVerbose, async () => {
    const nxCloudClient = (
      await verifyOrUpdateNxCloudClient(getCloudOptions())
    ).nxCloudClient;
    await nxCloudClient.commands.login();
  });
}
