import { execSync } from 'child_process';
import { URL } from 'node:url';
import { output } from '../../../utils/output';
import { Tree } from '../../../generators/tree';
import { readJson } from '../../../generators/utils/json';
import { NxJsonConfiguration } from '../../../config/nx-json';
import { readNxJson, updateNxJson } from '../../../generators/utils/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { repoUsesGithub, shortenedCloudUrl } from '../../utilities/url-shorten';
import { commitChanges } from '../../../utils/git-utils';
import * as ora from 'ora';
import * as open from 'open';

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
  token: string | undefined,
  installationSource: string,
  usesGithub?: boolean,
  directory?: string
) {
  const connectCloudUrl = await shortenedCloudUrl(
    installationSource,
    token,
    usesGithub
  );

  if (installationSource === 'nx-connect' && usesGithub) {
    try {
      const cloudConnectSpinner = ora(
        `Opening Nx Cloud ${connectCloudUrl} in your browser to connect your workspace.`
      ).start();
      await sleep(2000);
      open(connectCloudUrl);
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
  } else {
    if (installationSource === 'create-nx-workspace') {
      output.note({
        title: `Your Nx Cloud workspace is ready.`,
        bodyLines: [
          `To claim it, connect it to your Nx Cloud account:`,
          `- Push your repository to your git hosting provider.`,
          `- Go to the following URL to connect your workspace to Nx Cloud:`,
          '',
          `${connectCloudUrl}`,
        ],
      });
      commitChanges(
        `feat(nx): Added Nx Cloud token to your nx.json
          
          To connect your workspace to Nx Cloud, push your repository 
          to your git hosting provider and go to the following URL:   
          
          ${connectCloudUrl}`,
        directory
      );
    } else {
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
    }
  }
}

interface ConnectToNxCloudOptions {
  analytics?: boolean;
  installationSource?: string;
  hideFormatLogs?: boolean;
  github?: boolean;
  directory?: string;
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
    const usesGithub = await repoUsesGithub(schema.github);

    let responseFromCreateNxCloudWorkspace:
      | {
          token: string;
          url: string;
        }
      | undefined;

    // do NOT create Nx Cloud token (createNxCloudWorkspace)
    // if user is using github and is running nx-connect
    if (!(usesGithub && schema.installationSource === 'nx-connect')) {
      responseFromCreateNxCloudWorkspace = await createNxCloudWorkspace(
        getRootPackageName(tree),
        schema.installationSource,
        getNxInitDate()
      );

      addNxCloudOptionsToNxJson(
        tree,
        nxJson,
        responseFromCreateNxCloudWorkspace?.token
      );

      await formatChangedFilesWithPrettierIfAvailable(tree, {
        silent: schema.hideFormatLogs,
      });
    }
    const apiUrl = removeTrailingSlash(
      process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
    );
    return async () =>
      await printSuccessMessage(
        responseFromCreateNxCloudWorkspace?.url ?? apiUrl,
        responseFromCreateNxCloudWorkspace?.token,
        schema.installationSource,
        usesGithub,
        schema.directory
      );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default connectToNxCloud;
