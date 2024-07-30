import * as ora from 'ora';

import { execAndWait } from '../child-process-utils';
import { mapErrorToBodyLines } from '../error-utils';
import { output } from '../output';
import { getPackageManagerCommand, PackageManager } from '../package-manager';

export async function setupCI(
  directory: string,
  ci: string,
  packageManager: PackageManager
) {
  const ciSpinner = ora(`Generating CI workflow`).start();
  try {
    const pmc = getPackageManagerCommand(packageManager);
    const res = await execAndWait(
      `${pmc.exec} nx g @nx/workspace:ci-workflow --ci=${ci}`,
      directory
    );
    ciSpinner.succeed('CI workflow has been generated successfully');
    return res;
  } catch (e) {
    ciSpinner.fail();
    if (e instanceof Error) {
      output.error({
        title: `Failed to generate CI workflow`,
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }

    process.exit(1);
  } finally {
    ciSpinner.stop();
  }
}
