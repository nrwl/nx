import { output } from '../../utils/output';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { execSync } from 'child_process';
import { readNxJson } from '../../config/configuration';
import {
  getNxCloudToken,
  getNxCloudUrl,
  isNxCloudUsed,
} from '../../utils/nx-cloud-utils';
import { runNxSync } from '../../utils/child-process';
import { NxJsonConfiguration } from '../../config/nx-json';
import { NxArgs } from '../../utils/command-line-utils';

export function onlyDefaultRunnerIsUsed(nxJson: NxJsonConfiguration) {
  if (!nxJson.tasksRunnerOptions) {
    // No tasks runner options:
    // - If access token defined, uses cloud runner
    // - If no access token defined, uses default
    return !nxJson.nxCloudAccessToken;
  }
  const defaultRunner = nxJson.tasksRunnerOptions?.default;
  if (
    !defaultRunner.runner ||
    defaultRunner.runner === 'nx/tasks-runners/default'
  ) {
    return true;
  }
  return false;
}

export async function connectToNxCloudIfExplicitlyAsked(
  opts: NxArgs
): Promise<void> {
  if (opts['cloud'] === true) {
    const nxJson = readNxJson();
    if (!onlyDefaultRunnerIsUsed(nxJson)) return;

    output.log({
      title: '--cloud requires the workspace to be connected to Nx Cloud.',
    });
    runNxSync(`connect-to-nx-cloud`, {
      stdio: [0, 1, 2],
    });
    output.success({
      title: 'Your workspace has been successfully connected to Nx Cloud.',
    });
    process.exit(0);
  }
}

export async function connectToNxCloudCommand(
  promptOverride?: string
): Promise<boolean> {
  const nxJson = readNxJson();
  if (isNxCloudUsed(nxJson)) {
    output.log({
      title: '✅ This workspace is already connected to Nx Cloud.',
      bodyLines: [
        'This means your workspace can use computation caching, distributed task execution, and show you run analytics.',
        'Go to https://nx.app to learn more.',
        ' ',
        'If you have not done so already, please claim this workspace:',
        `${getNxCloudUrl(
          nxJson
        )}/orgs/workspace-setup?accessToken=${getNxCloudToken(nxJson)}`,
      ],
    });
    return false;
  }

  const res = await connectToNxCloudPrompt(promptOverride);
  if (!res) return false;
  const pmc = getPackageManagerCommand();
  if (pmc) {
    execSync(`${pmc.addDev} nx-cloud@latest`);
  } else {
    const nxJson = readNxJson();
    if (nxJson.installation) {
      nxJson.installation.plugins ??= {};
      nxJson.installation.plugins['nx-cloud'] = execSync(
        `npm view nx-cloud@latest version`
      ).toString();
    }
  }
  runNxSync(`g nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
  return true;
}

async function connectToNxCloudPrompt(prompt?: string) {
  return await (
    await import('enquirer')
  )
    .prompt([
      {
        name: 'NxCloud',
        message: prompt ?? `Enable distributed caching to make your CI faster`,
        type: 'autocomplete',
        choices: [
          {
            name: 'Yes',
            hint: 'I want faster builds',
          },
          {
            name: 'No',
          },
        ],
        initial: 'Yes' as any,
      },
    ])
    .then((a: { NxCloud: 'Yes' | 'No' }) => a.NxCloud === 'Yes');
}
