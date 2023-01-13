import { output } from '../utils/output';
import { getPackageManagerCommand } from '../utils/package-manager';
import { execSync } from 'child_process';
import { readNxJson } from '../config/configuration';
import {
  getNxCloudToken,
  getNxCloudUrl,
  isNxCloudUsed,
} from '../utils/nx-cloud-utils';

export async function connectToNxCloudIfExplicitlyAsked(opts: {
  [k: string]: any;
}): Promise<void> {
  if (opts['cloud'] === true) {
    const nxJson = readNxJson();
    const runners = Object.values(nxJson.tasksRunnerOptions);
    const onlyDefaultRunnerIsUsed =
      runners.length === 1 && runners[0].runner === 'nx/tasks-runners/default';
    if (!onlyDefaultRunnerIsUsed) return;

    output.log({
      title: '--cloud requires the workspace to be connected to Nx Cloud.',
    });
    const pmc = getPackageManagerCommand();
    execSync(`${pmc.exec} nx connect-to-nx-cloud`, {
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
  if (isNxCloudUsed()) {
    output.log({
      title: '✅ This workspace is already connected to Nx Cloud.',
      bodyLines: [
        'This means your workspace can use computation caching, distributed task execution, and show you run analytics.',
        'Go to https://nx.app to learn more.',
        ' ',
        'If you have not done so already, please claim this workspace:',
        `${getNxCloudUrl()}'/orgs/workspace-setup?accessToken=${getNxCloudToken()}`,
      ],
    });
    return false;
  }

  const res = await connectToNxCloudPrompt(promptOverride);
  if (!res) return false;
  const pmc = getPackageManagerCommand();
  execSync(`${pmc.addDev} @nrwl/nx-cloud@latest`);
  execSync(`${pmc.exec} nx g @nrwl/nx-cloud:init`, {
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
