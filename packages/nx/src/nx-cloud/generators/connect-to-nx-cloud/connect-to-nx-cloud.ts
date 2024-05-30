import { execSync } from 'child_process';
import { URL } from 'node:url';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson } from '../../../generators/utils/json';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { readNxJson, updateNxJson } from '../../../generators/utils/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { shortenedCloudUrl } from '../../utilities/url-shorten';

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

async function printSuccessMessage(
  url: string,
  token: string,
  installationSource: string,
  github: boolean
) {
  if (process.env.NX_NEW_CLOUD_ONBOARDING !== 'true') {
    let origin = 'https://nx.app';
    try {
      origin = new URL(url).origin;
    } catch (e) {}

    output.note({
      title: `Your Nx Cloud workspace is public`,
      bodyLines: [
        `To restrict access, connect it to your Nx Cloud account:`,
        `- Push your changes`,
        `- Login at ${origin} to connect your repository`,
      ],
    });
  } else {
    const connectCloudUrl = await shortenedCloudUrl(
      installationSource,
      token,
      github
    );

    output.note({
      title: `Your Nx Cloud workspace is ready.`,
      bodyLines: [
        `To claim it, connect it to your Nx Cloud account:`,
        `- Commit and push your changes.`,
        `- Create a pull request for the changes.`,
        `- Go to the following URL to connect your workspace to Nx Cloud: 
        
        ${connectCloudUrl}`,
      ],
    });
  }
}

interface ConnectToNxCloudOptions {
  analytics?: boolean;
  installationSource?: string;
  hideFormatLogs?: boolean;
  github?: boolean;
}

function addNxCloudOptionsToNxJson(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  token: string
) {
  nxJson ??= {
    extends: 'nx/presets/npm.json',
  };
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
  schema.installationSource ??= 'user';

  const nxJson = readNxJson(tree) as
    | null
    | (NxJsonConfiguration & { neverConnectToCloud: boolean });

  if (nxJson?.neverConnectToCloud) {
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

    await formatChangedFilesWithPrettierIfAvailable(tree, {
      silent: schema.hideFormatLogs,
    });

    return async () =>
      await printSuccessMessage(
        r.url,
        r.token,
        schema.installationSource,
        schema.github
      );
  }
}

export default connectToNxCloud;
