import { output } from '../../utils/output';
import { readNxJson } from '../../config/configuration';
import {
  getNxCloudToken,
  getNxCloudUrl,
  isNxCloudUsed,
} from '../../utils/nx-cloud-utils';
import { runNxSync } from '../../utils/child-process';
import { NxJsonConfiguration } from '../../config/nx-json';
import { NxArgs } from '../../utils/command-line-utils';
import {
  MessageKey,
  MessageOptionKey,
  recordStat,
  messages,
} from '../../utils/ab-testing';
import { nxVersion } from '../../utils/versions';
import chalk = require('chalk');

export function onlyDefaultRunnerIsUsed(nxJson: NxJsonConfiguration) {
  const defaultRunner = nxJson.tasksRunnerOptions?.default?.runner;

  if (!defaultRunner) {
    // No tasks runner options OR no default runner defined:
    // - If access token defined, uses cloud runner
    // - If no access token defined, uses default
    return !(nxJson.nxCloudAccessToken ?? process.env.NX_CLOUD_ACCESS_TOKEN);
  }

  return defaultRunner === 'nx/tasks-runners/default';
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

export async function connectToNxCloudCommand(): Promise<boolean> {
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

  runNxSync(`g nx:connect-to-nx-cloud --quiet --no-interactive`, {
    stdio: [0, 1, 2],
  });
  return true;
}

export async function connectToNxCloudWithPrompt(command: string) {
  const setNxCloud = await nxCloudPrompt();
  const useCloud = setNxCloud ? await connectToNxCloudCommand() : false;
  await recordStat({
    command,
    nxVersion,
    useCloud,
    meta: messages.codeOfSelectedPromptMessage('setupNxCloud'),
  });
}

export async function connectExistingRepoToNxCloudPrompt(): Promise<boolean> {
  return nxCloudPrompt().then((value: MessageOptionKey) => value === 'yes');
}

async function nxCloudPrompt(): Promise<MessageOptionKey> {
  const { message, choices, initial } = messages.getPrompt('setupNxCloud');

  return await (
    await import('enquirer')
  )
    .prompt<{ NxCloud: MessageOptionKey }>([
      {
        name: 'NxCloud',
        message,
        type: 'autocomplete',
        choices,
        initial,
        footer() {
          return chalk.dim`\nRead more about remote cache at https://nx.dev/ci/features/remote-cache`;
        },
        hint() {
          return chalk.dim`\n(it's free and can be disabled any time)`;
        },
      } as any, // meeroslav: types in enquirer are not up to date,
    ])
    .then((a) => {
      return a.NxCloud;
    });
}
