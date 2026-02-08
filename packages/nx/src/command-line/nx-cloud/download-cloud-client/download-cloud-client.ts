import { readNxJson } from '../../../config/nx-json';
import { verifyOrUpdateNxCloudClient } from '../../../nx-cloud/update-manager';
import { getCloudOptions } from '../../../nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { handleErrors } from '../../../utils/handle-errors';
import { output } from '../../../utils/output';
import { warnNotConnectedToCloud } from '../utils';

export interface DownloadCloudClientArgs {
  verbose?: boolean;
}

export function downloadCloudClientHandler(
  args: DownloadCloudClientArgs
): Promise<number> {
  if (!isNxCloudUsed(readNxJson())) {
    warnNotConnectedToCloud();
    return Promise.resolve(1);
  }

  return handleErrors(args.verbose, async () => {
    const options = getCloudOptions();
    const result = await verifyOrUpdateNxCloudClient(options);

    if (result) {
      output.success({
        title: 'Nx Cloud client downloaded successfully',
        bodyLines: [`Version: ${result.version}`],
      });
    }
  });
}
