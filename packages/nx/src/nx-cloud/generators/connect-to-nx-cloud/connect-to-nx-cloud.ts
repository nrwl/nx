import { execSync } from 'child_process';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson, updateJson } from '../../../generators/utils/json';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { readNxJson } from '../../../generators/utils/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { createNxCloudOnboardingURL } from '../../utilities/url-shorten';
import { getCloudUrl } from '../../utilities/get-cloud-options';
import { join } from 'path';
import { getVcsRemoteInfo } from '../../../utils/git-utils';

function printCloudConnectionDisabledMessage() {
  output.error({
    title: `Connections to Nx Cloud are disabled for this workspace`,
    bodyLines: [
      `This was an intentional decision by someone on your team.`,
      `Nx Cloud cannot and will not be enabled.`,
      ``,
      `To allow connections to Nx Cloud again, remove the 'neverConnectToCloud'`,
      `property in nx.json.`,
    ],
  });
}

function getRootPackageName(tree: Tree, directory: string): string {
  let packageJson;
  try {
    const packageJsonPath = join(directory, 'package.json');
    packageJson = readJson(tree, packageJsonPath);
  } catch (e) {}
  return packageJson?.name ?? 'my-workspace';
}

function getNxInitDate(): string | null {
  try {
    const nxInitIso = execSync(
      'git log --diff-filter=A --follow --format=%aI -- nx.json | tail -1',
      { stdio: 'pipe', windowsHide: false }
    )
      .toString()
      .trim();
    const nxInitDate = new Date(nxInitIso);
    return nxInitDate.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

async function createNxCloudWorkspaceV1(
  workspaceName: string,
  installationSource: string,
  nxInitDate: string | null
): Promise<{ token: string; url: string }> {
  const apiUrl = getCloudUrl();
  const response = await require('axios').post(
    `${apiUrl}/nx-cloud/create-org-and-workspace`,
    {
      workspaceName,
      installationSource,
      nxInitDate,
    }
  );

  if (response.data.message) {
    throw new Error(response.data.message);
  }

  return response.data;
}

async function createNxCloudWorkspaceV2(
  workspaceName: string,
  installationSource: string,
  nxInitDate: string | null
): Promise<{ nxCloudId: string; url: string }> {
  const apiUrl = getCloudUrl();
  const response = await require('axios').post(
    `${apiUrl}/nx-cloud/v2/create-org-and-workspace`,
    {
      workspaceName,
      installationSource,
      nxInitDate,
    }
  );

  if (response.data.message) {
    throw new Error(response.data.message);
  }

  return response.data;
}

export async function printSuccessMessage(
  token: string | undefined,
  installationSource: string
) {
  const connectCloudUrl = await createNxCloudOnboardingURL(
    installationSource,
    token,
    undefined,
    false
  );
  output.note({
    title: `Your Self-Healing CI and Remote Caching setup is almost complete`,
    bodyLines: [
      `1. Commit your changes and push a pull request to your repository.`,
      `2. Go to Nx Cloud and finish the setup: ${connectCloudUrl}`,
    ],
  });
  return connectCloudUrl;
}

export interface ConnectToNxCloudOptions {
  analytics?: boolean;
  installationSource?: string;
  hideFormatLogs?: boolean;
  github?: boolean;
  directory?: string;
  generateToken?: boolean;
}

function addNxCloudAccessTokenToNxJson(
  tree: Tree,
  token: string,
  directory: string = ''
) {
  const nxJsonPath = join(directory, 'nx.json');
  if (tree.exists(nxJsonPath)) {
    updateJson<NxJsonConfiguration>(
      tree,
      join(directory, 'nx.json'),
      (nxJson) => {
        const overrideUrl = process.env.NX_CLOUD_API || process.env.NRWL_API;
        if (overrideUrl) {
          nxJson.nxCloudUrl = overrideUrl;
        }
        nxJson.nxCloudAccessToken = token;

        return nxJson;
      }
    );
  }
}

function addNxCloudIdToNxJson(
  tree: Tree,
  nxCloudId: string,
  directory: string = ''
) {
  const nxJsonPath = join(directory, 'nx.json');
  if (tree.exists(nxJsonPath)) {
    updateJson<NxJsonConfiguration>(
      tree,
      join(directory, 'nx.json'),
      (nxJson) => {
        const overrideUrl = process.env.NX_CLOUD_API || process.env.NRWL_API;
        if (overrideUrl) {
          nxJson.nxCloudUrl = overrideUrl;
        }
        nxJson.nxCloudId = nxCloudId;

        return nxJson;
      }
    );
  }
}

export async function connectToNxCloud(
  tree: Tree,
  schema: ConnectToNxCloudOptions,
  nxJson = readNxJson(tree)
): Promise<string | null> {
  schema.installationSource ??= 'user';

  if (nxJson?.neverConnectToCloud) {
    printCloudConnectionDisabledMessage();
    return null;
  }
  const remoteInfo = await getVcsRemoteInfo();
  const isGitHubDetected = schema.github ?? remoteInfo?.domain === 'github.com';

  let responseFromCreateNxCloudWorkspaceV1:
    | {
        token: string;
      }
    | undefined;

  let responseFromCreateNxCloudWorkspaceV2:
    | {
        nxCloudId: string;
      }
    | undefined;

  /**
   * Do not create an Nx Cloud token if the user is using GitHub and
   * is running `nx-connect` AND `token` is undefined (override)
   */
  if (
    !schema.generateToken &&
    isGitHubDetected &&
    (schema.installationSource === 'nx-connect' ||
      schema.installationSource === 'nx-console')
  )
    return null;

  try {
    responseFromCreateNxCloudWorkspaceV2 = await createNxCloudWorkspaceV2(
      getRootPackageName(tree, schema.directory),
      schema.installationSource,
      getNxInitDate()
    );
  } catch (e) {
    if (e.response?.status === 404) {
      responseFromCreateNxCloudWorkspaceV1 = await createNxCloudWorkspaceV1(
        getRootPackageName(tree, schema.directory),
        schema.installationSource,
        getNxInitDate()
      );
    } else {
      throw e;
    }
  }

  if (responseFromCreateNxCloudWorkspaceV2) {
    addNxCloudIdToNxJson(
      tree,
      responseFromCreateNxCloudWorkspaceV2?.nxCloudId,
      schema.directory
    );
    await formatChangedFilesWithPrettierIfAvailable(tree, {
      silent: schema.hideFormatLogs,
    });
    return responseFromCreateNxCloudWorkspaceV2.nxCloudId;
  } else if (responseFromCreateNxCloudWorkspaceV1) {
    addNxCloudAccessTokenToNxJson(
      tree,
      responseFromCreateNxCloudWorkspaceV1?.token,
      schema.directory
    );
    await formatChangedFilesWithPrettierIfAvailable(tree, {
      silent: schema.hideFormatLogs,
    });
    return responseFromCreateNxCloudWorkspaceV1.token;
  } else {
    throw new Error(
      'Could not create an Nx Cloud Workspace. Please try again.'
    );
  }
}

async function connectToNxCloudGenerator(
  tree: Tree,
  options: ConnectToNxCloudOptions
) {
  await connectToNxCloud(tree, options);
}

export default connectToNxCloudGenerator;
