import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { printCloudConnectionDisabledMessage } from '../../utilities/print-cloud-connection-disabled-message';

function updateNxJson(json, token: string) {
  const alreadySetOptions = json.tasksRunnerOptions?.default?.options ?? {};

  const options = {
    ...alreadySetOptions,
    accessToken: token,
  };

  if (process.env.NX_CLOUD_API) {
    options.url = process.env.NX_CLOUD_API;
  }

  json.tasksRunnerOptions = {
    default: {
      runner: isNxVersion16OrHigher() ? 'nx-cloud' : '@nrwl/nx-cloud',
      options,
    },
  };
}

function readNxJsonUsingNx(host: any): any {
  try {
    const jsonUtils = require('nx/src/utils/json');
    return jsonUtils.parseJson(host.read('nx.json', 'utf-8'));
  } catch (ee) {
    return JSON.parse(host.read('nx.json', 'utf-8'));
  }
}

function writeNxJsonUsingNx(host: any, json: any, token: string) {
  updateNxJson(json, token);
  try {
    const jsonUtils = require('nx/src/utils/json');
    host.write('nx.json', jsonUtils.serializeJson(json));
  } catch (ee) {
    host.write('nx.json', JSON.stringify(json, null, 2));
  }
}

function getRootPackageName(): string {
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync('package.json').toString());
  } catch (e) {}
  return packageJson?.name ?? 'my-workspace';
}

function isNxVersion16OrHigher(): boolean {
  try {
    const packageJson = JSON.parse(readFileSync('package.json').toString());
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };
    if (
      deps['nx'].startsWith('15.') ||
      deps['nx'].startsWith('14.') ||
      deps['nx'].startsWith('13.') ||
      deps['nx'].startsWith('12.')
    ) {
      return false;
    } else {
      return true;
    }
  } catch (e) {
    return true;
  }
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
  const { output } = require('../../utilities/nx-imports-light');

  let host = 'nx.app';
  try {
    host = new (require('url').URL)(url).host;
  } catch (e) {}

  output.note({
    title: `Distributed caching via Nx Cloud has been enabled`,
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

export async function generator(host, schema) {
  const nxJson = readNxJsonUsingNx(host);

  if (nxJson.neverConnectToCloud) {
    return () => {
      printCloudConnectionDisabledMessage();
    };
  } else {
    // TODO: Change to using loading light client when that is enabled by default
    const r = await createNxCloudWorkspace(
      getRootPackageName(),
      schema.installationSource,
      getNxInitDate()
    );

    writeNxJsonUsingNx(host, nxJson, r.token);
    return () => printSuccessMessage(r.url);
  }
}
