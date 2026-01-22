import { VcsPushStatus } from '../git/git';
import { CLIOutput } from '../output';
import {
  getCompletionMessage,
  getSkippedCloudMessage,
  CompletionMessageKey,
} from './messages';
import { getFlowVariant, messages } from './ab-testing';
import * as ora from 'ora';

export type NxCloud =
  | 'yes'
  | 'github'
  | 'gitlab'
  | 'azure'
  | 'bitbucket-pipelines'
  | 'circleci'
  | 'skip';

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
  nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
  return accessToken || nxCloudId;
}

export async function createNxCloudOnboardingUrl(
  nxCloud: NxCloud,
  token: string,
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

  const meta = messages.codeOfSelectedPromptMessage('setupNxCloudV2');

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
  completionMessageKey?: CompletionMessageKey
) {
  const out = new CLIOutput(false);
  const message = getCompletionMessage(
    completionMessageKey,
    connectCloudUrl,
    pushedToVcs
  );
  out.success(message);
  return out.getOutput();
}

export function getSkippedNxCloudInfo() {
  const out = new CLIOutput(false);
  out.success(getSkippedCloudMessage());
  return out.getOutput();
}
