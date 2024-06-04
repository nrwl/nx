import { logger } from '../../devkit-exports';
import { getGithubSlugOrNull } from '../../utils/git-utils';

export async function shortenedCloudUrl(
  installationSource: string,
  accessToken: string,
  github?: boolean
) {
  const githubSlug = getGithubSlugOrNull();

  const apiUrl = removeTrailingSlash(
    process.env.NX_CLOUD_API || process.env.NRWL_API || `https://cloud.nx.app`
  );

  const installationSupportsGitHub = await getInstallationSupportsGitHub(
    apiUrl
  );

  const usesGithub =
    (githubSlug || github) &&
    (apiUrl.includes('cloud.nx.app') ||
      apiUrl.includes('eu.nx.app') ||
      installationSupportsGitHub);

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
      accessToken,
      source
    );
  }
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
  accessToken: string,
  source: string
) {
  if (usesGithub) {
    if (githubSlug) {
      return `${apiUrl}/setup/connect-workspace/vcs?provider=GITHUB&selectedRepositoryName=${encodeURIComponent(
        githubSlug
      )}&source=${source}`;
    } else {
      return `${apiUrl}/setup/connect-workspace/vcs?provider=GITHUB&source=${source}`;
    }
  }
  return `${apiUrl}/setup/connect-workspace/manual?accessToken=${accessToken}&source=${source}`;
}

async function getInstallationSupportsGitHub(apiUrl: string): Promise<boolean> {
  try {
    const response = await require('axios').get(`${apiUrl}/vcs-integrations`);
    if (!response?.data || response.data.message) {
      throw new Error(
        response?.data?.message ?? 'Failed to shorten Nx Cloud URL'
      );
    }
    return !!response.data.github;
  } catch (e) {
    if (process.env.NX_VERBOSE_LOGGING) {
      logger.warn(`Failed to access vcs-integrations endpoint.
    ${e}`);
    }
    return false;
  }
}
