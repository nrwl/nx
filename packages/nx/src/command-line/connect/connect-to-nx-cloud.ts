import { output } from '../../utils/output';
import { readNxJson } from '../../config/configuration';
import { FsTree, flushChanges } from '../../generators/tree';
import { connectToNxCloud } from '../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { shortenedCloudUrl } from '../../nx-cloud/utilities/url-shorten';
import { getNxCloudUrl, isNxCloudUsed } from '../../utils/nx-cloud-utils';
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
    if (process.env.NX_NEW_CLOUD_ONBOARDING !== 'true') {
      output.log({
        title: '✔ This workspace already has Nx Cloud set up',
        bodyLines: [
          'If you have not done so already, connect your workspace to your Nx Cloud account:',
          `- Login at ${getNxCloudUrl(nxJson)} to connect your repository`,
        ],
      });
    } else {
      const token =
        process.env.NX_CLOUD_ACCESS_TOKEN || nxJson.nxCloudAccessToken;
      if (!token) {
        throw new Error(
          `Unable to authenticate. Either define accessToken in nx.json or set the NX_CLOUD_ACCESS_TOKEN env variable.`
        );
      }
      const connectCloudUrl = await shortenedCloudUrl('nx-connect', token);
      output.log({
        title: '✔ This workspace already has Nx Cloud set up',
        bodyLines: [
          'If you have not done so already, connect your workspace to your Nx Cloud account:',
          `- Connect with Nx Cloud at: 
      
        ${connectCloudUrl}`,
        ],
      });
    }
    return false;
  }

  const tree = new FsTree(workspaceRoot, false, 'connect-to-nx-cloud');
  const callback = await connectToNxCloud(tree, {});
  tree.lock();
  flushChanges(workspaceRoot, tree.listChanges());
  await callback();

  return true;
}

export async function connectToNxCloudWithPrompt(command: string) {
  const setNxCloud = await nxCloudPrompt('setupNxCloud');
  const useCloud =
    setNxCloud === 'yes' ? await connectToNxCloudCommand() : false;
  await recordStat({
    command,
    nxVersion,
    useCloud,
    meta: messages.codeOfSelectedPromptMessage('setupNxCloud'),
  });
}

export async function connectExistingRepoToNxCloudPrompt(
  key: MessageKey = 'setupNxCloud'
): Promise<boolean> {
  return nxCloudPrompt(key).then((value: MessageOptionKey) => value === 'yes');
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
