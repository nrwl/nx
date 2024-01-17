import { execSync } from 'child_process';
import { URL } from 'node:url';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson } from '../../../generators/utils/json';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { readNxJson, updateNxJson } from '../../../generators/utils/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';

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
function removeTrailingSlash(apiUrl: string) {
  return apiUrl[apiUrl.length - 1] === '/'
    ? apiUrl.substr(0, apiUrl.length - 1)
    : apiUrl;
}

function getNxInitDate(): string | null {
  try {
    const nxInitIso = execSync(
      'git log --diff-filter=A --follow --format=%aI -- nx.json | tail -1',
      { stdio: 'pipe' }
    )
      .toString()
      .trim();
    const nxInitDate = new Date(nxInitIso);
    return nxInitDate.toISOString();
  } catch (e) {
    return null;
  }
}

async function createNxCloudWorkspace(
  workspaceName: string,
  installationSource: string,
  nxInitDate: string | null
): Promise<{ token: string; url: string }> {
  const apiUrl = removeTrailingSlash(
    process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
  );
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

function printSuccessMessage(url: string) {
  let host = 'nx.app';
  try {
    host = new URL(url).host;
  } catch (e) {}

  output.note({
    title: `Remote caching via Nx Cloud has been enabled`,
    bodyLines: [
      `In addition to the caching, Nx Cloud provides config-free distributed execution,`,
      `UI for viewing complex runs and GitHub integration. Learn more at https://nx.app`,
      ``,
      `Your workspace is currently unclaimed. Run details from unclaimed workspaces can be viewed on ${host} by anyone`,
      `with the link. Claim your workspace at the following link to restrict access.`,
      ``,
      `${url}`,
    ],
  });
}

interface ConnectToNxCloudOptions {
  analytics: boolean;
  installationSource: string;
}

function addNxCloudOptionsToNxJson(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  token: string
) {
  nxJson.nxCloudAccessToken = token;
  const overrideUrl = process.env.NX_CLOUD_API || process.env.NRWL_API;
  if (overrideUrl) {
    (nxJson as any).nxCloudUrl = overrideUrl;
  }
  updateNxJson(tree, nxJson);
}

export async function connectToNxCloud(
  tree: Tree,
  schema: ConnectToNxCloudOptions
) {
  const nxJson = readNxJson(tree);

  if ((nxJson as any).neverConnectToCloud) {
    return () => {
      printCloudConnectionDisabledMessage();
    };
  } else {
    // TODO: Change to using loading light client when that is enabled by default
    const r = await createNxCloudWorkspace(
      getRootPackageName(tree),
      schema.installationSource,
      getNxInitDate()
    );

    addNxCloudOptionsToNxJson(tree, nxJson, r.token);

    await formatChangedFilesWithPrettierIfAvailable(tree);

    return () => printSuccessMessage(r.url);
  }
}

export default connectToNxCloud;
