import * as ora from 'ora';
import { execAndWait } from '../child-process-utils';
import { output } from '../output';
import { getPackageManagerCommand, PackageManager } from '../package-manager';
import { mapErrorToBodyLines } from '../error-utils';

export type NxCloud = 'yes' | 'github' | 'circleci' | 'skip';

export async function setupNxCloud(
  directory: string,
  packageManager: PackageManager,
  nxCloud: NxCloud,
  useGitHub?: boolean
) {
  const nxCloudSpinner = ora(`Setting up Nx Cloud`).start();
  try {
    const pmc = getPackageManagerCommand(packageManager);
    const res = await execAndWait(
      `${
        pmc.exec
      } nx g nx:connect-to-nx-cloud --installationSource=create-nx-workspace --directory=${directory} ${
        useGitHub ? '--github' : ''
      } --no-interactive`,
      directory
    );

    if (nxCloud !== 'yes') {
      nxCloudSpinner.succeed(
        'CI workflow with Nx Cloud has been generated successfully'
      );
    } else {
      nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
    }
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
  // remove leading Nx carret and any new lines
  const logContent = nxCloudOut.split('NX   ')[1];
  const indexOfTitleEnd = logContent.indexOf('\n');
  const title = logContent.slice(0, logContent.indexOf('\n')).trim();
  const bodyLines = logContent
    .slice(indexOfTitleEnd)
    .replace(/^\n*/, '') // remove leading new lines
    .replace(/\n*$/, '') // remove trailing new lines
    .split('\n')
    .map((r) => r.trim());
  output.warn({
    title,
    bodyLines,
  });
}
