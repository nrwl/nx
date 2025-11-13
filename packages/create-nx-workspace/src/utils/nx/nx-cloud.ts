import { VcsPushStatus } from '../git/git';
import { CLIOutput } from '../output';
import { getMessageFactory } from './messages';
import * as ora from 'ora';

export type NxCloud =
  | 'yes'
  | 'github'
  | 'gitlab'
  | 'azure'
  | 'bitbucket-pipelines'
  | 'circleci'
  | 'skip';

function getCloudMessageSource(
  isTemplate: boolean,
  nxCloud: NxCloud
):
  | 'create-nx-workspace-template-cloud'
  | 'create-nx-workspace-success-cache-setup'
  | 'create-nx-workspace-success-ci-setup' {
  return isTemplate
    ? 'create-nx-workspace-template-cloud'
    : nxCloud === 'yes'
    ? 'create-nx-workspace-success-cache-setup'
    : 'create-nx-workspace-success-ci-setup';
}

export async function connectToNxCloudForTemplate(
  directory: string,
  installationSource: string,
  useGitHub?: boolean
): Promise<string | null> {
  // nx-ignore-next-line
  const { connectToNxCloud } = require(require.resolve(
    'nx/src/nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud',
    {
      paths: [directory],
    }
    // nx-ignore-next-line
  )) as typeof import('nx/src/nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud');

  // nx-ignore-next-line
  const { FsTree, flushChanges } = require(require.resolve(
    'nx/src/generators/tree',
    {
      paths: [directory],
      // nx-ignore-next-line
    }
  )) as typeof import('nx/src/generators/tree');

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
  const { getCloudOptions } = require(require.resolve(
    'nx/src/nx-cloud/utilities/get-cloud-options',
    {
      paths: [directory],
    }
    // nx-ignore-next-line
  )) as typeof import('nx/src/nx-cloud/utilities/get-cloud-options');

  const { accessToken, nxCloudId } = getCloudOptions(directory);
  nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
  return accessToken || nxCloudId;
}

export async function createNxCloudOnboardingUrl(
  nxCloud: NxCloud,
  token: string,
  directory: string,
  useGitHub?: boolean,
  isTemplate?: boolean,
  promptCode?: string
) {
  // nx-ignore-next-line
  const { createNxCloudOnboardingURL } = require(require.resolve(
    'nx/src/nx-cloud/utilities/url-shorten',
    {
      paths: [directory],
    }
    // nx-ignore-next-line
  )) as any;

  const source = getCloudMessageSource(!!isTemplate, nxCloud);
  const { code: successMessageCode } = getMessageFactory(source);

  // Combine prompt code with success message code
  // Format: "prompt-code:success-code" or just "success-code" if no prompt
  const meta = promptCode
    ? `${promptCode}:${successMessageCode}`
    : successMessageCode;

  return await createNxCloudOnboardingURL(
    source,
    token,
    meta,
    false,
    useGitHub ??
      (nxCloud === 'yes' || nxCloud === 'github' || nxCloud === 'circleci')
  );
}

export async function getNxCloudInfo(
  nxCloud: NxCloud,
  connectCloudUrl: string,
  pushedToVcs: VcsPushStatus,
  rawNxCloud?: NxCloud,
  isTemplate?: boolean
) {
  const source = getCloudMessageSource(!!isTemplate, nxCloud);
  const { createMessage } = getMessageFactory(source);
  const out = new CLIOutput(false);
  const message = createMessage(
    typeof rawNxCloud === 'string' ? null : connectCloudUrl,
    pushedToVcs
  );
  if (message.type === 'success') {
    out.success(message);
  } else {
    out.warn(message);
  }
  return out.getOutput();
}
