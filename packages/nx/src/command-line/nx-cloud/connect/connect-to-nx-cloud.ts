import { join } from 'path';
import { handleImport } from '../../../utils/handle-import';
import { output } from '../../../utils/output';
import { readNxJson } from '../../../config/configuration';
import { FsTree, flushChanges } from '../../../generators/tree';
import {
  connectToNxCloud,
  ConnectToNxCloudOptions,
} from '../../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud';
import { createNxCloudOnboardingURL } from '../../../nx-cloud/utilities/url-shorten';
import { isNxCloudUsed } from '../../../utils/nx-cloud-utils';
import { writeJsonFile } from '../../../utils/fileutils';
import { runNxSync } from '../../../utils/child-process';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { NxArgs } from '../../../utils/command-line-utils';
import {
  MessageKey,
  MessageOptionKey,
  recordStat,
  messages,
} from '../../../utils/ab-testing';
import { nxVersion } from '../../../utils/versions';
import { isCI } from '../../../utils/is-ci';
import { isAiAgent } from '../../../native';
import { detectPackageManager } from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getVcsRemoteInfo } from '../../../utils/git-utils';
import {
  CONNECTED_NEXT_STEPS,
  hasNxCloudPat,
  OnboardStatus,
  runAgenticOnboard,
  runOnboardStatus,
} from '../onboard/agentic-onboard';
import { writeAiOutput } from '../../ai/ai-output';
import * as pc from 'picocolors';
const ora = require('ora');
const open = require('open');

export function onlyDefaultRunnerIsUsed(nxJson: NxJsonConfiguration) {
  const defaultRunner = nxJson.tasksRunnerOptions?.default?.runner;

  if (!defaultRunner) {
    // No tasks runner options OR no default runner defined:
    // - If access token defined, uses cloud runner
    // - If no access token defined, uses default
    return (
      !(
        nxJson.nxCloudAccessToken ??
        process.env.NX_CLOUD_AUTH_TOKEN ??
        process.env.NX_CLOUD_ACCESS_TOKEN
      ) && !nxJson.nxCloudId
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
  options: { generateToken?: boolean; checkRemote?: boolean },
  command?: string
): Promise<boolean> {
  // `connectToNxCloudWithPrompt` (called from `migrate`) records its own stat; skip here to avoid double-counting.
  const selfRecord = !command;
  const baseMeta = {
    nodeVersion: process.versions.node,
    os: process.platform,
    packageManager: detectPackageManager(),
    aiAgent: isAiAgent(),
    isCI: isCI(),
  };
  if (selfRecord) {
    await recordStat({
      command: 'connect',
      nxVersion,
      useCloud: true,
      meta: { type: 'start', ...baseMeta },
    });
  }
  try {
    const result = await runConnectToNxCloud(options, command);
    if (selfRecord) {
      await recordStat({
        command: 'connect',
        nxVersion,
        useCloud: result,
        meta: { type: 'complete', ...baseMeta },
      });
    }
    return result;
  } catch (error) {
    if (selfRecord) {
      const message =
        (error instanceof Error && error.message) ||
        String(error ?? 'Unknown error');
      const errorName =
        typeof (error as any)?.code === 'string'
          ? ((error as any).code as string)
          : error instanceof Error
            ? error.name
            : typeof error;
      await recordStat({
        command: 'connect',
        nxVersion,
        useCloud: false,
        meta: {
          type: 'error',
          errorCode: 'UNKNOWN',
          errorName,
          errorMessage: message.slice(0, 500),
          ...baseMeta,
        },
      });
    }
    throw error;
  }
}

async function runConnectToNxCloud(
  options: { generateToken?: boolean; checkRemote?: boolean },
  command?: string
): Promise<boolean> {
  const nxJson = readNxJson();

  const installationSource = process.env.NX_CONSOLE
    ? 'nx-console'
    : 'nx-connect';

  const aiMode = isAiAgent();

  // Agent mode: hybrid flow.
  //   - PAT present  → full agentic onboard (org select, GitHub auth, etc.) via NDJSON.
  //   - PAT missing  → emit needs_input directing the agent to run `nx login`.
  //                    `nx login` defers to the cloud client and works in any
  //                    directory (with or without an existing connection) as
  //                    of nx 22.6.0 — the previous `isNxCloudUsed` guard was
  //                    removed in #34728. Login writes the PAT to
  //                    ~/.config/nxcloud/nxcloud.ini. After login, agent re-runs
  //                    `nx connect` and falls into the PAT-present branch.
  if (aiMode) {
    // Already connected? Short-circuit. Mirrors the human-mode `isNxCloudUsed`
    // check below — without this, a re-run of `nx connect` from a connected
    // workspace re-spawns the bin which then 409s with "Workspace already
    // exists" because the name is taken on the server. The agent reads that
    // as a fix-this-input failure even though the connection is fine.
    if (isNxCloudUsed(nxJson) && nxJson.nxCloudId) {
      writeAiOutput({
        stage: 'complete',
        success: true,
        status: 'connected',
        nxCloudId: nxJson.nxCloudId,
        verifyCommand: 'npx nx-cloud onboard status',
        message: 'Workspace is already connected to Nx Cloud.',
        nextSteps: CONNECTED_NEXT_STEPS,
      });
      return true;
    }
    if (!hasNxCloudPat()) {
      writeAiOutput({
        stage: 'needs_input',
        success: false,
        actionRequired: 'login_required',
        message:
          'Nx Cloud authentication is required. Run `npx nx login` to authenticate (one-time browser OAuth), then re-run `nx connect`.',
        nextCommand: 'npx nx login',
        statusCheck: 'npx nx-cloud login --status',
        hint: '`nx login` opens a browser for one-time OAuth; the resulting PAT is saved to ~/.config/nxcloud/nxcloud.ini and reused for all future workspaces.',
      });
      return false;
    }
    const result = await runAgenticOnboard({ source: 'nx-connect' });
    return result.status === 'connected';
  }

  const hasRemote = !!getVcsRemoteInfo();
  if (!hasRemote && options.checkRemote) {
    output.error({
      title: 'Missing VCS provider',
      bodyLines: [
        'Push this repository to a VCS provider (e.g., GitHub) and try again.',
        'Go to https://github.com/new to create a repository on GitHub.',
      ],
    });
    return false;
  }

  if (isNxCloudUsed(nxJson)) {
    const token =
      process.env.NX_CLOUD_AUTH_TOKEN ||
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
      undefined,
      options?.generateToken === true
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

  // PAT present → bin can call the API directly, no browser-claim needed.
  // Browser opens only as a fallback for github_oauth / github_app_install.
  // Needs a remote for the bin's repo detection.
  if (hasRemote && hasNxCloudPat()) {
    return runHumanOnboardWithPat(installationSource, workspaceRoot);
  }

  const token = await connectWorkspaceToCloud({
    generateToken: options?.generateToken,
    installationSource: command ?? installationSource,
  });

  const connectCloudUrl = await createNxCloudOnboardingURL(
    'nx-connect',
    token,
    undefined,
    options?.generateToken === true
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

async function runHumanOnboardWithPat(
  source: 'nx-connect' | 'nx-console',
  cwd: string
): Promise<boolean> {
  // Pre-flight prompt for multi-org. Skips a wasted spawn just to read the
  // bin's "specify --org" error.
  const status = await runOnboardStatus(cwd);
  let org: string | undefined;
  if (status && status.organizations.length > 1) {
    org = await pickOrgPrompt(status.organizations);
    if (!org) {
      output.note({ title: 'Cancelled.' });
      return false;
    }
  }

  const spinner = ora('Connecting workspace to Nx Cloud...').start();
  const result = await runAgenticOnboard({
    source,
    cwd,
    org,
    onProgress: (p) => {
      if (
        typeof p.message === 'string' &&
        !('success' in p) &&
        !('actionRequired' in p)
      ) {
        spinner.text = p.message;
      }
    },
  });

  if (result.status === 'connected') {
    spinner.succeed(
      `Connected. Workspace${
        result.nxCloudUrl ? ` → ${result.nxCloudUrl}` : ''
      }`
    );
    output.note({
      title: 'Verify remote caching',
      bodyLines: [
        'Run a cacheable target twice (build/test/lint). Second run should be a cache hit.',
        `Status check: ${result.verifyCommand}`,
      ],
    });
    return true;
  }

  if (result.status === 'needs_input') {
    spinner.warn(result.message);
    if (result.verificationUri) {
      output.note({
        title: 'Action required',
        bodyLines: [
          `Open: ${result.verificationUri}`,
          ...(result.userCode ? [`Enter code: ${result.userCode}`] : []),
          '',
          'After completing in the browser, re-run `nx connect`.',
        ],
      });
      // Fire-and-forget; URL is printed above so a failure to open is fine.
      open(result.verificationUri).catch(() => {});
    } else if (result.actionRequired === 'login_required') {
      output.note({
        title: 'Login required',
        bodyLines: [
          'Run `npx nx login` to authenticate, then re-run `nx connect`.',
        ],
      });
    }
    return false;
  }

  spinner.fail(result.message);
  return false;
}

async function pickOrgPrompt(
  organizations: OnboardStatus['organizations']
): Promise<string | undefined> {
  const enquirer = await handleImport('enquirer');
  try {
    const answer = (await enquirer.prompt([
      {
        type: 'select',
        name: 'org',
        message: 'Pick an Nx Cloud organization for this workspace',
        choices: organizations.map((o) => ({
          name: o.id,
          message: o.name,
          hint: o.role ? `(${o.role})` : undefined,
        })),
      } as any,
    ])) as { org: string };
    return answer.org;
  } catch {
    return undefined;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectExistingRepoToNxCloudPrompt(
  command = 'init',
  key: MessageKey = 'setupNxCloud'
): Promise<MessageOptionKey> {
  const res = await nxCloudPrompt(key);
  await recordStat({
    command,
    nxVersion,
    useCloud: res === 'yes',
    meta: {
      type: 'complete',
      setupCloudPrompt: messages.codeOfSelectedPromptMessage(key) || '',
      nxCloudArg: res,
      nodeVersion: process.versions.node,
      os: process.platform,
      packageManager: detectPackageManager(),
      aiAgent: isAiAgent(),
      isCI: isCI(),
    },
  });
  return res;
}

export async function connectToNxCloudWithPrompt(command: string) {
  const setNxCloud = await nxCloudPrompt('setupNxCloud');
  let useCloud = false;
  if (setNxCloud === 'yes') {
    useCloud = await connectToNxCloudCommand({ generateToken: false }, command);
  } else if (setNxCloud === 'never') {
    const nxJsonPath = join(workspaceRoot, 'nx.json');
    const nxJson = readNxJson();
    if (nxJson) {
      nxJson.neverConnectToCloud = true;
      writeJsonFile(nxJsonPath, nxJson);
    }
  }
  await recordStat({
    command,
    nxVersion,
    useCloud,
    meta: {
      type: 'complete',
      setupCloudPrompt:
        messages.codeOfSelectedPromptMessage('setupNxCloud') || '',
      nxCloudArg: setNxCloud,
      nodeVersion: process.versions.node,
      os: process.platform,
      packageManager: detectPackageManager(),
      aiAgent: isAiAgent(),
      isCI: isCI(),
    },
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
    promptConfig.footer = () => pc.dim(footer);
  }
  if (hint) {
    promptConfig.hint = () => pc.dim(hint);
  }

  const enquirer = await handleImport('enquirer');
  return await enquirer
    .prompt([promptConfig])
    .then((a: { NxCloud: MessageOptionKey }) => {
      return a.NxCloud;
    });
}
