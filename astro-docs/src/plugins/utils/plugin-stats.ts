interface Interval {
  start: Date;
  end: Date;
}

export interface PluginRegistry {
  name: string;
  description: string;
  url: string;
}

export function getLastMonth(): Interval {
  const now = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1);
  return {
    start: oneMonthAgo,
    end: now,
  };
}

export function stringifyIntervalForUrl(interval: Interval): string {
  return `${stringifyDate(interval.start)}:${stringifyDate(interval.end)}`;
}

export function stringifyDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Publish date (and github directory, readme content)
 * i.e. https://registry.npmjs.org/@nxkit/playwright
 * */
export async function getNpmData(
  plugin: PluginRegistry,
  skipNxVersion = false
) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${plugin.name}`);
    const data = (await response.json()) as NpmRegistryResponse;
    const lastPublishedDate = data.time?.[data['dist-tags']?.latest]
      ? new Date(data.time?.[data['dist-tags'].latest])
      : undefined;
    const nxVersion = skipNxVersion ? undefined : await getNxVersion(data);

    if (!data.repository) {
      console.warn(
        `- No repository defined in package.json for ${plugin.name}`
      );
      return { lastPublishedDate, nxVersion, githubRepo: '' };
    }

    const url: string = data.repository.url;
    const indexOfTree = url.indexOf('/tree/');
    const githubRepo = url
      .slice(0, indexOfTree === -1 ? undefined : indexOfTree)
      .slice(0, url.indexOf('#') === -1 ? undefined : url.indexOf('#'))
      .slice(url.indexOf('github.com/') + 11)
      .replace('.git', '');

    return {
      lastPublishedDate,
      githubRepo,
      nxVersion,
    };
  } catch (ex) {
    console.warn('Failed to load npm data for ' + plugin.name, ex);
    return {
      lastPublishedDate: undefined,
      githubRepo: '',
      nxVersion: '',
    };
  }
}

/**
 * Download count
 * i.e. https://api.npmjs.org/downloads/point/2023-06-01:2023-07-01/@nxkit/playwright
 **/
export async function getNpmDownloads(plugin: PluginRegistry): Promise<number> {
  const lastMonth = getLastMonth();
  try {
    const response = await fetch(
      `https://api.npmjs.org/downloads/point/${stringifyIntervalForUrl(
        lastMonth
      )}/${plugin.name}`
    );
    const data = (await response.json()) as NpmDownloadRequest;
    return data.downloads;
  } catch (ex) {
    console.warn('Failed to load npm downloads for ' + plugin.name, ex);
    return 0;
  }
}

async function getNxVersion(data: NpmRegistryResponse) {
  const latest = data['dist-tags'].latest;
  const nxPackages = ['@nx/devkit', '@nx/workspace'];
  let devkitVersion = '';
  for (let i = 0; i < nxPackages.length && !devkitVersion; i++) {
    const packageName = nxPackages[i];
    if (data.versions[latest]?.dependencies) {
      devkitVersion = data.versions[latest]?.dependencies[packageName];
      if (devkitVersion) {
        return await findNxRange(devkitVersion);
      }
    }
    if (!devkitVersion && data.versions[latest]?.peerDependencies) {
      devkitVersion = data.versions[latest]?.peerDependencies[packageName];
      if (devkitVersion) {
        return await findNxRange(devkitVersion);
      }
    }
  }
  console.warn(`- No dependency on @nx/devkit for ${data.name}`);
  return devkitVersion;
}

async function findNxRange(devkitVersion: string) {
  devkitVersion = devkitVersion
    .replace('^', '')
    .replace('>=', '')
    .replace('>', '');
  const response = await fetch(`https://registry.npmjs.org/@nx/devkit`);
  const devkitData = (await response.json()) as NpmRegistryResponse;
  if (!devkitData.versions[devkitVersion]?.peerDependencies) {
    const dependencies = devkitData.versions[devkitVersion]?.dependencies;
    return dependencies?.nx;
  }
  return devkitData.versions[devkitVersion]?.peerDependencies?.nx;
}

/**
 * Stars
 * i.e. https://api.github.com/graphql
 * */
export async function getGithubStars(
  repos: { owner: string; repo: string }[]
): Promise<Map<string, GitHubRepoStarResult>> {
  if (process.env.GITHUB_TOKEN === undefined) {
    // TODO(caleb): should we error in CI if the token isn't set?
    console.warn('No GITHUB_TOKEN set!');
    return new Map<string, GitHubRepoStarResult>();
  }
  const query = `
  fragment repoProperties on Repository {
    nameWithOwner
    stargazers {
      totalCount
    }
  }
  
  {
    ${repos
      .filter(({ owner, repo }) => owner && repo && !owner.includes('.'))
      .map(
        ({ owner, repo }) =>
          `${owner.replace(/[\-#]/g, '')}${repo.replace(
            /[\-#]/g,
            ''
          )}: repository(owner: "${owner}", name: "${repo}") {
      ...repoProperties
    }`
      )
      .join('\n')}
  }`;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    });

    const result = (await response.json()) as {
      data: {
        [escapedName: string]: GitHubRepoStarResult;
      };
    };

    const reposWithStars = new Map<string, GitHubRepoStarResult>();

    Object.entries(result.data).forEach(([_, repo]) => {
      // NOTE: returned GH response escapes the repo name for the key i.e. org/repo -> orgrepo,
      // so we return the expected repo name the consumer is expecting
      reposWithStars.set(repo.nameWithOwner, repo);
    });

    return reposWithStars;
  } catch (err) {
    console.warn('Failed to load github stars', err);
    return new Map<string, GitHubRepoStarResult>();
  }
}

type GitHubRepoStarResult = {
  nameWithOwner: string;
  stargazers: {
    totalCount: number;
  };
};

type NpmRegistryResponse = {
  name: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, NpmRegistryVersion>;
  time?: Record<string, string>;
  repository?: Record<string, string>;
};

type NpmRegistryVersion = {
  name: string;
  version: string;
  keywords: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type NpmDownloadRequest = {
  downloads: number;
  /**
   *YYYY-MM-DD
   */
  start: string;
  /**
   *YYYY-MM-DD
   */
  end: string;
  package: string;
};

type CacheableEntry = {
  data: {
    lastFetched?: Date;
  };
};

const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7;
export function shouldFetchStats(
  existingEntry: CacheableEntry | undefined
): boolean {
  if (process.env.CI === 'true') {
    return true;
  }

  if (!existingEntry?.data?.lastFetched) {
    return true;
  }
  const timeSinceLastFetch =
    Date.now() - new Date(existingEntry.data.lastFetched).getTime();
  return timeSinceLastFetch > ONE_WEEK_MS;
}

export const PLUGIN_IGNORE_LIST = [
  'add-nx-to-monorepo',
  'cra-to-nx',
  'create-nx-plugin',
  'create-nx-workspace',
  'make-angular-cli-faster',
  'tao',
];
