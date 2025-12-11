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
 * Delay utility for throttling API requests
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delay between npm API requests to avoid rate limiting (in ms)
 */
const NPM_REQUEST_DELAY_MS = 1000;

/**
 * Track the last npm API request time for rate limiting
 */
let lastNpmRequestTime = 0;

/**
 * Publish date (and github directory, readme content)
 * i.e. https://registry.npmjs.org/@nxkit/playwright
 * */
export async function getNpmData(
  plugin: PluginRegistry,
  skipNxVersion = false
) {
  // Rate limit: wait if needed to ensure 1 second between npm requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastNpmRequestTime;
  if (timeSinceLastRequest < NPM_REQUEST_DELAY_MS) {
    await delay(NPM_REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  lastNpmRequestTime = Date.now();

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

  // Rate limit: wait if needed to ensure 1 second between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastNpmRequestTime;
  if (timeSinceLastRequest < NPM_REQUEST_DELAY_MS) {
    await delay(NPM_REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  lastNpmRequestTime = Date.now();

  const url = `https://api.npmjs.org/downloads/point/${stringifyIntervalForUrl(
    lastMonth
  )}/${plugin.name}`;
  try {
    const response = await fetch(url);
    const data = (await response.json()) as NpmDownloadRequest;
    console.log(`Loaded npm stats for ${plugin.name}`);
    return data.downloads ?? 0;
  } catch (ex) {
    console.warn(
      'Failed to load npm downloads for ' + plugin.name + `(${url})`,
      ex
    );
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

  // Rate limit: wait if needed to ensure 1 second between npm requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastNpmRequestTime;
  if (timeSinceLastRequest < NPM_REQUEST_DELAY_MS) {
    await delay(NPM_REQUEST_DELAY_MS - timeSinceLastRequest);
  }
  lastNpmRequestTime = Date.now();

  const response = await fetch(`https://registry.npmjs.org/@nx/devkit`);
  const devkitData = (await response.json()) as NpmRegistryResponse;
  if (!devkitData.versions[devkitVersion]?.peerDependencies) {
    const dependencies = devkitData.versions[devkitVersion]?.dependencies;
    return dependencies?.nx;
  }
  return devkitData.versions[devkitVersion]?.peerDependencies?.nx;
}

export async function getGithubStars(
  repos: { owner: string; repo: string }[]
): Promise<Map<string, GitHubRepoStarResult>> {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('GITHUB_TOKEN not set. GitHub stars will not be fetched.');
    return new Map<string, GitHubRepoStarResult>();
  }

  const validRepos = repos.filter(
    ({ owner, repo }) => owner && repo && !owner.includes('.')
  );

  if (validRepos.length === 0) {
    return new Map<string, GitHubRepoStarResult>();
  }

  console.log(`Fetching GitHub stars for ${validRepos.length} repos...`);

  const query = `
  fragment repoProperties on Repository {
    nameWithOwner
    stargazers {
      totalCount
    }
  }

  {
    ${validRepos
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

    if (!response.ok) {
      console.error(
        `GitHub API error: ${response.status} ${response.statusText}`
      );

      try {
        console.warn(await response.text());
      } catch (e) {
        console.error('unable to parse response body');
        console.error(e);
      }
      return new Map<string, GitHubRepoStarResult>();
    }

    const result = (await response.json()) as {
      data?: {
        [escapedName: string]: GitHubRepoStarResult;
      };
      errors?: Array<{ message: string; type?: string; path?: string[] }>;
    };

    if (result.errors && result.errors.length > 0) {
      console.error(
        `GitHub GraphQL errors: ${result.errors
          .map((e) => e.message)
          .join(', ')}`
      );
    }

    if (!result.data || Object.keys(result.data).length === 0) {
      console.warn('GitHub API returned no data', result);
      return new Map<string, GitHubRepoStarResult>();
    }

    const reposWithStars = new Map<string, GitHubRepoStarResult>();

    Object.values(result.data).forEach((repo) => {
      if (repo && repo.nameWithOwner) {
        // NOTE: returned GH response escapes the repo name for the key i.e. org/repo -> orgrepo,
        // so we return the expected repo name the consumer is expecting
        reposWithStars.set(repo.nameWithOwner, repo);
      }
    });

    console.log(`Fetched stars for ${reposWithStars.size} repos`);

    return reposWithStars;
  } catch (err) {
    console.error('Failed to fetch GitHub stars:', err);
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

/**
 * Checks if plugin stats fetching is enabled.
 * Stats are only fetched when:
 * - Running in CI (CI=true), OR
 * - Explicitly enabled via NX_DOCS_PLUGIN_STATS=true
 */
export function isPluginStatsFetchingEnabled(): boolean {
  return (
    process.env.CI === 'true' || process.env.NX_DOCS_PLUGIN_STATS === 'true'
  );
}

export function shouldFetchStats(
  existingEntry: CacheableEntry | undefined
): boolean {
  if (!isPluginStatsFetchingEnabled()) {
    return false;
  }

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

/**
 * Common plugin stats structure shared across all plugin loaders
 */
export interface PluginStats {
  githubStars: number;
  npmDownloads: number;
  lastPublishedDate: Date | undefined;
  nxVersion?: string;
  lastFetched: Date | undefined;
}

/**
 * Type for any store entry that has cacheable stats
 */
export interface StatsEntry {
  data?: {
    githubStars?: number;
    npmDownloads?: number;
    lastPublishedDate?: Date;
    nxVersion?: string;
    lastFetched?: Date;
  };
}

/**
 * Extract cached stats from an existing store entry, or return defaults if not available.
 * This is a generic helper used by all plugin loaders.
 *
 * @param existingEntry The existing entry from the store (if any)
 * @param includeNxVersion Whether to include nxVersion in the result (for community plugins)
 * @returns Stats object with cached values or safe defaults
 */
export function getCachedOrDefaultStats(
  existingEntry: StatsEntry | undefined,
  includeNxVersion = false
): PluginStats {
  if (existingEntry?.data) {
    const stats: PluginStats = {
      githubStars: existingEntry.data.githubStars ?? 0,
      npmDownloads: existingEntry.data.npmDownloads ?? 0,
      lastPublishedDate: existingEntry.data.lastPublishedDate,
      lastFetched: existingEntry.data.lastFetched,
    };

    if (includeNxVersion) {
      stats.nxVersion = existingEntry.data.nxVersion ?? '';
    }

    return stats;
  }

  // Return defaults when no cached data is available
  const defaults: PluginStats = {
    githubStars: 0,
    npmDownloads: 0,
    lastPublishedDate: undefined,
    lastFetched: undefined,
  };

  if (includeNxVersion) {
    defaults.nxVersion = '';
  }

  return defaults;
}

/**
 * Fetch fresh plugin stats from NPM and GitHub.
 * This is a generic helper that can be used by all plugin loaders.
 *
 * @param plugin The plugin to fetch stats for
 * @param repoKey The key to look up GitHub stars (e.g., 'nrwl/nx' or 'owner/repo')
 * @param ghStarMap Map of GitHub stars by repo key
 * @param includeNxVersion Whether to fetch and include nxVersion
 * @returns Fresh stats from external sources
 */
export async function fetchFreshStats(
  plugin: PluginRegistry,
  repoKey: string,
  ghStarMap: Map<string, GitHubRepoStarResult>,
  includeNxVersion = false
): Promise<PluginStats> {
  const [npmDownloads, npmMeta] = await Promise.all([
    getNpmDownloads(plugin),
    getNpmData(plugin, !includeNxVersion),
  ]);

  const stats: PluginStats = {
    githubStars: ghStarMap.get(repoKey)?.stargazers?.totalCount ?? 0,
    npmDownloads,
    lastPublishedDate: npmMeta.lastPublishedDate,
    lastFetched: new Date(),
  };

  if (includeNxVersion && npmMeta.nxVersion) {
    stats.nxVersion = npmMeta.nxVersion;
  }

  return stats;
}
