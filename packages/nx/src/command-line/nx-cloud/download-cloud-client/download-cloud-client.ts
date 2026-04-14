import { readNxJson } from '../../../config/nx-json';
import { verifyOrUpdateNxCloudClient } from '../../../nx-cloud/update-manager';
import { getCloudOptions } from '../../../nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { handleErrors } from '../../../utils/handle-errors';
import { output } from '../../../utils/output';

export interface DownloadCloudClientArgs {
  verbose?: boolean;
}

export function downloadCloudClientHandler(
  args: DownloadCloudClientArgs
): Promise<number> {
  return handleErrors(args.verbose, async () => {
    // Try to get cloud options from nx.json if available, otherwise
    // fall back to defaults (env vars / https://cloud.nx.app).
    let options: { url?: string; customProxyConfigPath?: string } = {};
    try {
      const nxJson = readNxJson();
      if (isNxCloudUsed(nxJson)) {
        options = getCloudOptions();
      }
    } catch {
      // Not in an Nx workspace — use defaults
    }

    const result = await verifyOrUpdateNxCloudClient(options);

    if (result) {
      output.success({
        title: 'Nx Cloud client downloaded successfully',
        bodyLines: [`Version: ${result.version}`],
      });
    }
  });
}
