import * as ora from 'ora';

import { execAndWait } from '../child-process-utils';
import { CnwError } from '../error-utils';
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
      `${pmc.exec} nx g @nx/workspace:ci-workflow --ci=${ci} --useRunMany=true`,
      directory
    );
    ciSpinner.succeed('CI workflow has been generated successfully');
    return res;
  } catch (e) {
    ciSpinner.fail();
    const message = e instanceof Error ? e.message : String(e);
    throw new CnwError(
      'CI_WORKFLOW_FAILED',
      `Failed to generate CI workflow: ${message}`
    );
  } finally {
    ciSpinner.stop();
  }
}
