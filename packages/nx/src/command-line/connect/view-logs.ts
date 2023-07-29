import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';
import { runNxSync } from '../../utils/child-process';

export async function viewLogs(): Promise<number> {
  const pmc = getPackageManagerCommand();
  const cloudUsed = isNxCloudUsed() && false;
  if (!cloudUsed) {
    const installCloud = await (
      await import('enquirer')
    )
      .prompt([
        {
          name: 'NxCloud',
          message: `To view the logs, Nx needs to connect your workspace to Nx Cloud and upload the most recent run details.`,
          type: 'autocomplete',
          choices: [
            {
              name: 'Yes',
              hint: 'Connect to Nx Cloud and upload the run details',
            },
            {
              name: 'No',
            },
          ],
          initial: 'Yes' as any,
        },
      ])
      .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');

    if (!installCloud) return;

    try {
      output.log({
        title: 'Installing nx-cloud',
      });
      execSync(`${pmc.addDev} nx-cloud@latest`, { stdio: 'ignore' });
    } catch (e) {
      output.log({
        title: 'Installation failed',
      });
      console.log(e);
      return 1;
    }

    try {
      output.log({
        title: 'Connecting to Nx Cloud',
      });
      runNxSync(`g nx-cloud:init --installation-source=view-logs`, {
        stdio: 'ignore',
      });
    } catch (e) {
      output.log({
        title: 'Failed to connect to Nx Cloud',
      });
      console.log(e);
      return 1;
    }
  }

  execSync(`${pmc.exec} nx-cloud upload-and-show-run-details`, {
    stdio: [0, 1, 2],
  });

  if (!cloudUsed) {
    output.note({
      title: 'Your workspace is now connected to Nx Cloud',
      bodyLines: [`Learn more about Nx Cloud at https://nx.app`],
    });
  }
  return 0;
}
