import { execSync } from 'child_process';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson, updateJson } from '../../../generators/utils/json';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { readNxJson } from '../../../generators/utils/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import {
  repoUsesGithub,
  createNxCloudOnboardingURL,
} from '../../utilities/url-shorten';
import { getCloudUrl } from '../../utilities/get-cloud-options';
import { join } from 'path';

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

function getRootPackageName(tree: Tree): string {
  let packageJson;
  try {
    packageJson = readJson(tree, 'package.json');
  } catch (e) {}
  return packageJson?.name ?? 'my-workspace';
}

function getNxInitDate(): string | null {
  try {
    const nxInitIso = execSync(
      'git log --diff-filter=A --follow --format=%aI -- nx.json | tail -1',
      { stdio: 'pipe', windowsHide: true }
    )
      .toString()
      .trim();
    const nxInitDate = new Date(nxInitIso);
    return nxInitDate.toISOString();
  } catch (e) {
    return null;
  }
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
  installationSource: string,
  usesGithub: boolean
) {
  const connectCloudUrl = await createNxCloudOnboardingURL(
    installationSource,
    token,
    usesGithub
  );
  output.note({
    title: `Your Nx Cloud workspace is ready.`,
    bodyLines: [
      `To claim it, connect it to your Nx Cloud account:`,
      `- Commit and push your changes.`,
      `- Create a pull request for the changes.`,
      `- Go to the following URL to connect your workspace to Nx Cloud:`,
      '',
      `${connectCloudUrl}`,
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
  const isGitHubDetected =
    schema.github ?? (await repoUsesGithub(schema.github));

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
    schema.installationSource === 'nx-connect'
  )
    return null;

  responseFromCreateNxCloudWorkspaceV2 = await createNxCloudWorkspaceV2(
    getRootPackageName(tree),
    schema.installationSource,
    getNxInitDate()
  );

  addNxCloudIdToNxJson(
    tree,
    responseFromCreateNxCloudWorkspaceV2?.nxCloudId,
    schema.directory
  );

  await formatChangedFilesWithPrettierIfAvailable(tree, {
    silent: schema.hideFormatLogs,
  });
  return responseFromCreateNxCloudWorkspaceV2.nxCloudId;
}

async function connectToNxCloudGenerator(
  tree: Tree,
  options: ConnectToNxCloudOptions
) {
  await connectToNxCloud(tree, options);
}

export default connectToNxCloudGenerator;
