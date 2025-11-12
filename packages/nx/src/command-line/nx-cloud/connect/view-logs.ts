import { getPackageManagerCommand } from '../../../utils/package-manager.js';
import { execSync } from 'child_process';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils.js';
import { output } from '../../../utils/output.js';
import { readNxJson } from '../../../config/nx-json.js';
import {
  connectExistingRepoToNxCloudPrompt,
  connectWorkspaceToCloud,
} from './connect-to-nx-cloud.js';
import { printSuccessMessage } from '../../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud.js';

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

  const setupNxCloud = await connectExistingRepoToNxCloudPrompt(
    'view-logs',
    'setupViewLogs'
  );
  if (!setupNxCloud) {
    return;
  }

  try {
    output.log({
      title: 'Connecting to Nx Cloud',
    });
    await connectWorkspaceToCloud({
      installationSource: 'view-logs',
      generateToken: true,
    });
  } catch (e) {
    output.log({
      title: 'Failed to connect to Nx Cloud',
    });
    console.log(e);
    return 1;
  }

  const pmc = getPackageManagerCommand();
  execSync(`${pmc.exec} nx-cloud upload-and-show-run-details`, {
    stdio: [0, 1, 2],
    windowsHide: false,
  });

  if (!cloudUsed) {
    output.note({
      title: 'Your workspace is now connected to Nx Cloud',
      bodyLines: [`Learn more about Nx Cloud at https://nx.dev/nx-cloud`],
    });
  }
  return 0;
}
