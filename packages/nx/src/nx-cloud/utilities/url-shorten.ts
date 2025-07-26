import { logger } from '../../utils/logger';
import { getCloudUrl } from './get-cloud-options';
import { getVcsRemoteInfo } from '../../utils/git-utils';

/**
 * This is currently duplicated in Nx Console. Please let @MaxKless know if you make changes here.
 */
export async function createNxCloudOnboardingURL(
  onboardingSource: string,
  accessToken?: string,
  meta?: string,
  forceManual = false,
  forceGithub = false
) {
  const remoteInfo = getVcsRemoteInfo();
  const apiUrl = getCloudUrl();

  const installationSupportsGitHub = await getInstallationSupportsGitHub(
    apiUrl
  );

  let usesGithub = false;
  if (forceGithub) {
    usesGithub = installationSupportsGitHub;
  } else if (forceManual) {
    usesGithub = false;
  } else {
    usesGithub =
      remoteInfo?.domain === 'github.com' && installationSupportsGitHub;
  }
  const source = getSource(onboardingSource);
  try {
    const response = await require('axios').post(
      `${apiUrl}/nx-cloud/onboarding`,
      {
        type: usesGithub ? 'GITHUB' : 'MANUAL',
        source,
        accessToken: usesGithub ? null : accessToken,
        selectedRepositoryName: remoteInfo?.slug ?? null,
        repositoryDomain: remoteInfo?.domain ?? null,
        meta,
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
      usesGithub ? remoteInfo?.slug : null,
      apiUrl,
      source,
      accessToken
    );
  }
}

function getSource(
  installationSource: string
): 'nx-init' | 'nx-connect' | string {
  if (installationSource.includes('nx-init')) {
    return 'nx-init';
  } else if (installationSource.includes('nx-connect')) {
    return 'nx-connect';
  } else {
    return installationSource;
  }
}

export function getURLifShortenFailed(
  usesGithub: boolean,
  githubSlug: string | null,
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
      return `${apiUrl}/setup/connect-workspace/github/select?source=${source}`;
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
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      logger.warn(`Failed to access system features. GitHub integration assumed to be disabled.
    ${e}`);
    }
    return false;
  }
}
