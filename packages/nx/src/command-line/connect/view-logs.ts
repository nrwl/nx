import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';
import { runNxSync } from '../../utils/child-process';
import { readNxJson } from '../../config/nx-json';
import chalk = require('chalk');

export async function viewLogs(): Promise<number> {
  const cloudUsed = isNxCloudUsed(readNxJson());
  if (cloudUsed) {
    output.error({
      title: 'Your workspace is already connected to Nx Cloud',
      bodyLines: [
        `Refer to the output of the last command to find the Nx Cloud link to view the run details.`,
      ],
    });
    return 1;
  }

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
        initial: 'Yes',
        hint() {
          return chalk.dim`\n(it's free and can be disabled any time)`;
        },
        footer() {
          return chalk.dim`\nRead more about remote cache at https://nx.dev/ci/features/remote-cache`;
        },
      } as any,
    ])
    .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');

  if (!installCloud) return;

  const pmc = getPackageManagerCommand();

  try {
    output.log({
      title: 'Connecting to Nx Cloud',
    });
    runNxSync(
      `g nx:connect-to-nx-cloud --installation-source=view-logs --quiet --no-interactive`,
      {
        stdio: 'ignore',
      }
    );
  } catch (e) {
    output.log({
      title: 'Failed to connect to Nx Cloud',
    });
    console.log(e);
    return 1;
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
