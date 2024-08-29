import { output } from '../../utils/output';
import { readNxJson } from '../../config/configuration';
import { FsTree, flushChanges } from '../../generators/tree';
import {
  connectToNxCloud,
  ConnectToNxCloudOptions,
} from '../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { createNxCloudOnboardingURL } from '../../nx-cloud/utilities/url-shorten';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
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
import { workspaceRoot } from '../../utils/workspace-root';
import chalk = require('chalk');
import * as ora from 'ora';
import * as open from 'open';

export function onlyDefaultRunnerIsUsed(nxJson: NxJsonConfiguration) {
  const defaultRunner = nxJson.tasksRunnerOptions?.default?.runner;

  if (!defaultRunner) {
    // No tasks runner options OR no default runner defined:
    // - If access token defined, uses cloud runner
    // - If no access token defined, uses default
    return (
      !(nxJson.nxCloudAccessToken ?? process.env.NX_CLOUD_ACCESS_TOKEN) &&
      !nxJson.nxCloudId
    );
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

export async function connectWorkspaceToCloud(
  options: ConnectToNxCloudOptions,
  directory = workspaceRoot
) {
  const tree = new FsTree(directory, false, 'connect-to-nx-cloud');
  const accessToken = await connectToNxCloud(tree, options);
  tree.lock();
  flushChanges(directory, tree.listChanges());
  return accessToken;
}

export async function connectToNxCloudCommand(
  options: { generateToken?: boolean },
  command?: string
): Promise<boolean> {
  const nxJson = readNxJson();

  const installationSource = process.env.NX_CONSOLE
    ? 'nx-console'
    : 'nx-connect';

  if (isNxCloudUsed(nxJson)) {
    const token =
      process.env.NX_CLOUD_ACCESS_TOKEN ||
      nxJson.nxCloudAccessToken ||
      nxJson.nxCloudId;
    if (!token) {
      throw new Error(
        `Unable to authenticate. If you are connecting to Nx Cloud locally, set Nx Cloud ID in nx.json. If you are connecting in a CI context, either define accessToken in nx.json or set the NX_CLOUD_ACCESS_TOKEN env variable.`
      );
    }
    const connectCloudUrl = await createNxCloudOnboardingURL(
      installationSource,
      token,
      options?.generateToken !== true
    );
    output.log({
      title: '✔ This workspace already has Nx Cloud set up',
      bodyLines: [
        'If you have not done so already, connect your workspace to your Nx Cloud account with the following URL:',
        '',
        `${connectCloudUrl}`,
      ],
    });

    return false;
  }
  const token = await connectWorkspaceToCloud({
    generateToken: options?.generateToken,
    installationSource: command ?? installationSource,
  });

  const connectCloudUrl = await createNxCloudOnboardingURL(
    'nx-connect',
    token,
    options?.generateToken !== true
  );
  try {
    const cloudConnectSpinner = ora(
      `Opening Nx Cloud ${connectCloudUrl} in your browser to connect your workspace.`
    ).start();
    await sleep(2000);
    await open(connectCloudUrl);
    cloudConnectSpinner.succeed();
  } catch (e) {
    output.note({
      title: `Your Nx Cloud workspace is ready.`,
      bodyLines: [
        `To claim it, connect it to your Nx Cloud account:`,
        `- Go to the following URL to connect your workspace to Nx Cloud:`,
        '',
        `${connectCloudUrl}`,
      ],
    });
  }

  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectExistingRepoToNxCloudPrompt(
  command = 'init',
  key: MessageKey = 'setupNxCloud'
): Promise<boolean> {
  const res = await nxCloudPrompt(key).then(
    (value: MessageOptionKey) => value === 'yes'
  );
  await recordStat({
    command,
    nxVersion,
    useCloud: res,
    meta: messages.codeOfSelectedPromptMessage(key),
  });
  return res;
}

export async function connectToNxCloudWithPrompt(command: string) {
  const setNxCloud = await nxCloudPrompt('setupNxCloud');
  const useCloud =
    setNxCloud === 'yes'
      ? await connectToNxCloudCommand({ generateToken: false }, command)
      : false;
  await recordStat({
    command,
    nxVersion,
    useCloud,
    meta: messages.codeOfSelectedPromptMessage('setupNxCloud'),
  });
}

async function nxCloudPrompt(key: MessageKey): Promise<MessageOptionKey> {
  const { message, choices, initial, footer, hint } = messages.getPrompt(key);

  const promptConfig = {
    name: 'NxCloud',
    message,
    type: 'autocomplete',
    choices,
    initial,
  } as any; // meeroslav: types in enquirer are not up to date
  if (footer) {
    promptConfig.footer = () => chalk.dim(footer);
  }
  if (hint) {
    promptConfig.hint = () => chalk.dim(hint);
  }

  return await (await import('enquirer'))
    .prompt<{ NxCloud: MessageOptionKey }>([promptConfig])
    .then((a) => {
      return a.NxCloud;
    });
}
