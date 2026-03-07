import { VcsPushStatus } from '../git/git';
import { CLIOutput } from '../output';
import { getCompletionMessage, getSkippedCloudMessage } from './messages';
import { getFlowVariant } from './ab-testing';
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
  // NXC-4020: Restored to v22.1.3 wording
  nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
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

// NXC-4020: Restored v22.1.3 signature — determines message from nxCloud value,
// uses rawNxCloud to decide whether to show URL (hide when user passed --nxCloud explicitly).
// Previous signature: (connectCloudUrl, pushedToVcs, completionMessageKey?, workspaceName?)
export async function getNxCloudInfo(
  nxCloud: NxCloud,
  connectCloudUrl: string,
  pushedToVcs: VcsPushStatus,
  rawNxCloud?: NxCloud
) {
  const completionMessageKey = nxCloud === 'yes' ? 'cache-setup' : 'ci-setup';
  const out = new CLIOutput(false);
  // When rawNxCloud is a string (user explicitly passed --nxCloud), hide the URL
  // because the user "already knows" where to go
  const url = typeof rawNxCloud === 'string' ? null : connectCloudUrl;
  const message = getCompletionMessage(completionMessageKey, url, pushedToVcs);
  out.success(message);
  return out.getOutput();
}

export function getSkippedNxCloudInfo() {
  const out = new CLIOutput(false);
  out.success(getSkippedCloudMessage());
  return out.getOutput();
}

export function setNeverConnectToCloud(directory: string): void {
  const { readFileSync, writeFileSync } = require('fs');
  const { join } = require('path');
  const nxJsonPath = join(directory, 'nx.json');
  const nxJson = JSON.parse(readFileSync(nxJsonPath, 'utf-8'));
  nxJson.neverConnectToCloud = true;
  writeFileSync(nxJsonPath, JSON.stringify(nxJson, null, 2) + '\n');
}
