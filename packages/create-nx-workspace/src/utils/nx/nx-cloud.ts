import { VcsPushStatus } from '../git/git';
import { isCI } from '../ci/is-ci';
import { CLIOutput } from '../output';
import {
  getCompletionMessage,
  getSkippedCloudMessage,
  CompletionMessageKey,
} from './messages';
import { getBannerVariant, getFlowVariant } from './ab-testing';
import { nxVersion } from './nx-version';
import ora from 'ora';

export type NxCloud =
  | 'yes'
  | 'github'
  | 'gitlab'
  | 'azure'
  | 'bitbucket-pipelines'
  | 'circleci'
  | 'skip'
  | 'never';

export async function connectToNxCloudForTemplate(
  directory: string,
  installationSource: string,
  useGitHub?: boolean
): Promise<string | null> {
  // nx-ignore-next-line
  const { connectToNxCloud } = require(
    require.resolve(
      'nx/src/nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud',
      {
        paths: [directory],
      }
      // nx-ignore-next-line
    )
  ) as typeof import('nx/src/nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud');

  // nx-ignore-next-line
  const { FsTree, flushChanges } = require(
    require.resolve('nx/src/generators/tree', {
      paths: [directory],
      // nx-ignore-next-line
    })
  ) as typeof import('nx/src/generators/tree');

  const tree = new FsTree(directory, false);
  const result = await connectToNxCloud(tree, {
    installationSource,
    directory: '',
    github: useGitHub,
  });

  // Flush the tree changes to disk
  flushChanges(directory, tree.listChanges());

  return result;
}

export function readNxCloudToken(directory: string) {
  const nxCloudSpinner = ora(`Checking Nx Cloud setup`).start();
  // nx-ignore-next-line
  const { getCloudOptions } = require(
    require.resolve(
      'nx/src/nx-cloud/utilities/get-cloud-options',
      {
        paths: [directory],
      }
      // nx-ignore-next-line
    )
  ) as typeof import('nx/src/nx-cloud/utilities/get-cloud-options');

  const { accessToken, nxCloudId } = getCloudOptions(directory);
  nxCloudSpinner.succeed('Nx Cloud configuration was successfully added');
  return accessToken || nxCloudId;
}

export async function createNxCloudOnboardingUrl(
  nxCloud: NxCloud,
  token: string | undefined,
  directory: string,
  useGitHub?: boolean
): Promise<string> {
  // nx-ignore-next-line
  const { createNxCloudOnboardingURL } = require(
    require.resolve(
      'nx/src/nx-cloud/utilities/url-shorten',
      {
        paths: [directory],
      }
      // nx-ignore-next-line
    )
  ) as any;

  // Source determines the onboarding flow type
  const source =
    nxCloud === 'yes'
      ? 'create-nx-workspace-success-cache-setup'
      : 'create-nx-workspace-success-ci-setup';

  const meta = JSON.stringify({
    variant: getFlowVariant(),
    nxVersion,
  });

  return createNxCloudOnboardingURL(
    source,
    token,
    meta,
    false,
    useGitHub ??
      (nxCloud === 'yes' || nxCloud === 'github' || nxCloud === 'circleci'),
    directory
  );
}

export async function getNxCloudInfo(
  connectCloudUrl: string,
  pushedToVcs: VcsPushStatus,
  completionMessageKey?: CompletionMessageKey,
  workspaceName?: string
) {
  const out = new CLIOutput(false);
  // Get the banner variant based on the cloud URL
  // Enterprise URLs automatically get variant 0 (plain link)
  const bannerVariant = getBannerVariant(connectCloudUrl);
  const message = getCompletionMessage(
    completionMessageKey,
    connectCloudUrl,
    pushedToVcs,
    workspaceName,
    bannerVariant
  );

  // Variant 2 (deferred connection): No title, just output the banner directly
  // without the NX badge since nothing was actually configured
  if (!message.title) {
    out.addNewline();
    out.writeLines(message.bodyLines ?? []);
  } else {
    out.success(message);
  }
  return out.getOutput();
}

export function getSkippedNxCloudInfo() {
  const out = new CLIOutput(false);
  out.success(getSkippedCloudMessage());
  return out.getOutput();
}

export function openCloudSetupUrl(opts: {
  connectUrl: string;
  workspaceDirectory: string;
}): void {
  if (isCI()) {
    return;
  }

  try {
    // Open through the workspace's own Nx rather than bundling a second opener
    // here. Only the preset flow installs this CLI's version — `--template` and
    // third-party presets install whatever Nx *they* pin, which may predate
    // `openUrl`, so the optional call no-ops. The banner printed after this
    // carries the URL either way.
    //
    // Load the bindings directly: `nx/src/native` is a loader shim that copies
    // the multi-MB .node into a cache and loads the copy. The key is derived from
    // cwd, which here is the parent of the new workspace, so nothing ever reuses
    // it. Skipping the shim also loses its WASI ExperimentalWarning filter, but
    // that only surfaces on the wasm fallback, where `openUrl` is a stub anyway.
    // nx-ignore-next-line
    const nativePath = require.resolve('nx/src/native/native-bindings.js', {
      paths: [opts.workspaceDirectory],
    });
    const { openUrl } = require(nativePath) as {
      openUrl?: (url: string) => boolean;
    };
    openUrl?.(opts.connectUrl);
  } catch {
    // Fail gracefully — the banner still carries the URL
  }
}

export function setNeverConnectToCloud(directory: string): void {
  const { readFileSync, writeFileSync } = require('fs');
  const { join } = require('path');
  const nxJsonPath = join(directory, 'nx.json');
  const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
  nxJson.neverConnectToCloud = true;
  writeFileSync(nxJsonPath, JSON.stringify(nxJson, null, 2) + '\n');
}
