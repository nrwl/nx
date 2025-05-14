import { logger } from '../../utils/logger';
import { getGithubSlugOrNull } from '../../utils/git-utils';
import { getCloudUrl } from './get-cloud-options';

/**
 * This is currently duplicated in Nx Console. Please let @MaxKless know if you make changes here.
 */
export async function createNxCloudOnboardingURL(
  onboardingSource: string,
  accessToken?: string,
  usesGithub?: boolean,
  meta?: string
) {
  const githubSlug = getGithubSlugOrNull();

  const apiUrl = getCloudUrl();

  if (usesGithub === undefined || usesGithub === null) {
    usesGithub = await repoUsesGithub(undefined, githubSlug, apiUrl);
  }

  try {
    const version = await getNxCloudVersion(apiUrl);
    if (
      (version && compareCleanCloudVersions(version, '2406.11.5') < 0) ||
      !version
    ) {
      return apiUrl;
    }
  } catch (e) {
    logger.verbose(`Failed to get Nx Cloud version.
    ${e}`);
    return apiUrl;
  }

  const source = getSource(onboardingSource);

  try {
    const response = await require('axios').post(
      `${apiUrl}/nx-cloud/onboarding`,
      {
        type: usesGithub ? 'GITHUB' : 'MANUAL',
        source,
        accessToken: usesGithub ? null : accessToken,
        selectedRepositoryName: githubSlug === 'github' ? null : githubSlug,
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
      githubSlug === 'github' ? null : githubSlug,
      apiUrl,
      source,
      accessToken
    );
  }
}

export async function repoUsesGithub(
  github?: boolean,
  githubSlug?: string,
  apiUrl?: string
): Promise<boolean> {
  if (!apiUrl) {
    apiUrl = getCloudUrl();
  }
  if (!githubSlug) {
    githubSlug = getGithubSlugOrNull();
  }
  const installationSupportsGitHub = await getInstallationSupportsGitHub(
    apiUrl
  );

  return (
    (!!githubSlug || !!github) &&
    (apiUrl.includes('cloud.nx.app') ||
      apiUrl.includes('eu.nx.app') ||
      installationSupportsGitHub)
  );
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
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      logger.warn(`Failed to access system features. GitHub integration assumed to be disabled. 
    ${e}`);
    }
    return false;
  }
}

export async function getNxCloudVersion(
  apiUrl: string
): Promise<string | null> {
  try {
    const response = await require('axios').get(
      `${apiUrl}/nx-cloud/system/version`
    );
    const version = removeVersionModifier(response.data.version);
    const isValid = versionIsValid(version);
    if (!version) {
      throw new Error('Failed to extract version from response.');
    }
    if (!isValid) {
      throw new Error(`Invalid version format: ${version}`);
    }
    return version;
  } catch (e) {
    logger.verbose(`Failed to get version of Nx Cloud.
      ${e}`);
    return null;
  }
}

export function removeVersionModifier(versionString: string): string {
  // Cloud version string is in the format of YYMM.DD.BuildNumber-Modifier
  return versionString.split(/[\.-]/).slice(0, 3).join('.');
}

export function versionIsValid(version: string): boolean {
  // Updated Regex pattern to require YYMM.DD.BuildNumber format
  // All parts are required, including the BuildNumber.
  const pattern = /^\d{4}\.\d{2}\.\d+$/;
  return pattern.test(version);
}

export function compareCleanCloudVersions(
  version1: string,
  version2: string
): number {
  const parseVersion = (version: string) => {
    // The format we're using is YYMM.DD.BuildNumber
    const parts = version.split('.').map((part) => parseInt(part, 10));
    return {
      yearMonth: parts[0],
      day: parts[1],
      buildNumber: parts[2],
    };
  };

  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.yearMonth !== v2.yearMonth) {
    return v1.yearMonth > v2.yearMonth ? 1 : -1;
  }
  if (v1.day !== v2.day) {
    return v1.day > v2.day ? 1 : -1;
  }
  if (v1.buildNumber !== v2.buildNumber) {
    return v1.buildNumber > v2.buildNumber ? 1 : -1;
  }

  return 0;
}
