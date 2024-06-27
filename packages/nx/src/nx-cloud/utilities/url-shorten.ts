import { logger } from '../../devkit-exports';
import { getGithubSlugOrNull } from '../../utils/git-utils';
import { lt } from 'semver';

export async function shortenedCloudUrl(
  installationSource: string,
  accessToken?: string,
  usesGithub?: boolean
) {
  const githubSlug = getGithubSlugOrNull();

  const apiUrl = removeTrailingSlash(
    process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
  );

  const version = await getNxCloudVersion(apiUrl);

  if (version && lt(removeVersionModifier(version), '2406.11.5')) {
    return apiUrl;
  }

  const source = getSource(installationSource);

  try {
    const response = await require('axios').post(
      `${apiUrl}/nx-cloud/onboarding`,
      {
        type: usesGithub ? 'GITHUB' : 'MANUAL',
        source,
        accessToken: usesGithub ? null : accessToken,
        selectedRepositoryName: githubSlug,
      }
    );

    if (!response?.data || response.data.message) {
      throw new Error(
        response?.data?.message ?? 'Failed to shorten Nx Cloud URL'
      );
    }

    return `${apiUrl}/connect/${response.data}`;
  } catch (e) {
    logger.verbose(`Failed to shorten Nx Cloud URL.
    ${e}`);
    return getURLifShortenFailed(
      usesGithub,
      githubSlug,
      apiUrl,
      source,
      accessToken
    );
  }
}

export async function repoUsesGithub(github?: boolean) {
  const githubSlug = getGithubSlugOrNull();

  const apiUrl = removeTrailingSlash(
    process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
  );

  const installationSupportsGitHub = await getInstallationSupportsGitHub(
    apiUrl
  );

  return (
    (githubSlug || github) &&
    (apiUrl.includes('cloud.nx.app') ||
      apiUrl.includes('eu.nx.app') ||
      installationSupportsGitHub)
  );
}

function removeTrailingSlash(apiUrl: string) {
  return apiUrl[apiUrl.length - 1] === '/' ? apiUrl.slice(0, -1) : apiUrl;
}

function getSource(
  installationSource: string
): 'nx-init' | 'nx-connect' | 'create-nx-workspace' | 'other' {
  if (installationSource.includes('nx-init')) {
    return 'nx-init';
  } else if (installationSource.includes('nx-connect')) {
    return 'nx-connect';
  } else if (installationSource.includes('create-nx-workspace')) {
    return 'create-nx-workspace';
  } else {
    return 'other';
  }
}

function getURLifShortenFailed(
  usesGithub: boolean,
  githubSlug: string,
  apiUrl: string,
  source: string,
  accessToken?: string
) {
  if (usesGithub) {
    if (githubSlug) {
      return `${apiUrl}/setup/connect-workspace/github/connect?name=${encodeURIComponent(
        githubSlug
      )}&source=${source}`;
    } else {
      return `${apiUrl}/setup/connect-workspace/github/select&source=${source}`;
    }
  }
  return `${apiUrl}/setup/connect-workspace/manual?accessToken=${accessToken}&source=${source}`;
}

async function getInstallationSupportsGitHub(apiUrl: string): Promise<boolean> {
  try {
    const response = await require('axios').get(
      `${apiUrl}/nx-cloud/system/features`
    );
    if (!response?.data || response.data.message) {
      throw new Error(
        response?.data?.message ?? 'Failed to shorten Nx Cloud URL'
      );
    }
    return !!response.data.isGithubIntegrationEnabled;
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING) {
      logger.warn(`Failed to access system features. GitHub integration assumed to be disabled. 
    ${e}`);
    }
    return false;
  }
}

async function getNxCloudVersion(apiUrl: string): Promise<string | null> {
  try {
    const response = await require('axios').get(
      `${apiUrl}/nx-cloud/system/version`
    );
    const version = removeVersionModifier(response.data.version);
    if (!version) {
      throw new Error('Failed to extract version from response.');
    }
    return version;
  } catch (e) {
    logger.verbose(`Failed to get version of Nx Cloud.
      ${e}`);
  }
}

function removeVersionModifier(versionString: string): string {
  // version may be something like 2406.13.5.hotfix2
  return versionString.split(/[\.-]/).slice(0, 3).join('.');
}
