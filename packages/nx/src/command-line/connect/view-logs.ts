import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';
import { readNxJson } from '../../config/nx-json';
import {
  connectExistingRepoToNxCloudPrompt,
  connectWorkspaceToCloud,
} from './connect-to-nx-cloud';
import { printSuccessMessage } from '../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { repoUsesGithub } from '../../nx-cloud/utilities/url-shorten';

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
    const token = await connectWorkspaceToCloud({
      installationSource: 'view-logs',
    });

    await printSuccessMessage(token, 'view-logs', await repoUsesGithub());
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
    windowsHide: true,
  });

  if (!cloudUsed) {
    output.note({
      title: 'Your workspace is now connected to Nx Cloud',
      bodyLines: [`Learn more about Nx Cloud at https://nx.app`],
    });
  }
  return 0;
}
