import * as ora from 'ora';
import { join } from 'path';
import { execAndWait } from '../child-process-utils';
import { output } from '../output';
import { getPackageManagerCommand, PackageManager } from '../package-manager';
import { mapErrorToBodyLines } from '../error-utils';

export async function setupNxCloud(
  directory: string,
  packageManager: PackageManager
) {
  const nxCloudSpinner = ora(`Setting up Nx Cloud`).start();
  try {
    const pmc = getPackageManagerCommand(packageManager);
    const res = await execAndWait(
      `${pmc.exec} nx g nx:connect-to-nx-cloud --no-interactive --quiet`,
      directory
    );
    nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
    return res;
  } catch (e) {
    nxCloudSpinner.fail();

    if (e instanceof Error) {
      output.error({
        title: `Failed to setup Nx Cloud`,
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }

    process.exit(1);
  } finally {
    nxCloudSpinner.stop();
  }
}

export function printNxCloudSuccessMessage(nxCloudOut: string) {
  const bodyLines = nxCloudOut
    .split('Remote caching via Nx Cloud has been enabled')[1]
    .trim();
  output.note({
    title: `Remote caching via Nx Cloud has been enabled`,
    bodyLines: bodyLines.split('\n').map((r) => r.trim()),
  });
}
