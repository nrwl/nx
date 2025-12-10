import type { Loader, LoaderContext } from 'astro/loaders';
import { watchAndCall } from './utils/watch';
import communityPlugins from '../content/approved-community-plugins.json';
import type { CollectionEntry } from 'astro:content';
import {
  getGithubStars,
  shouldFetchStats,
  isPluginStatsFetchingEnabled,
  getCachedOrDefaultStats,
  fetchFreshStats,
  type PluginStats,
} from './utils/plugin-stats';

type DocEntry = CollectionEntry<'community-plugins'>;

/**
 * Create a community plugin entry with the given stats
 */
function createCommunityPluginEntry(
  plugin: { name: string; url: string; description: string },
  stats: PluginStats
): DocEntry {
  return {
    id: plugin.name,
    collection: 'community-plugins',
    data: {
      title: plugin.name,
      slug: plugin.name,
      description: plugin.description,
      url: plugin.url,
      githubStars: stats.githubStars,
      npmDownloads: stats.npmDownloads,
      lastPublishedDate: stats.lastPublishedDate,
      nxVersion: stats.nxVersion ?? '',
      lastFetched: stats.lastFetched,
    },
  };
}

async function loadCommunityPluginsData(
  logger: LoaderContext['logger'],
  store: LoaderContext['store']
): Promise<void> {
  logger.info('Loading community plugins data...');

  const failedProcessed = new Set<string>();

  // Fetch GitHub stars for all plugins in one API call (only if fetching is enabled)
  let ghStarsList = new Map<
    string,
    { nameWithOwner: string; stargazers: { totalCount: number } }
  >();

  if (isPluginStatsFetchingEnabled()) {
    const ghPluginList = communityPlugins
      .filter((p) => p.url.startsWith('https://github.com'))
      .map((p) => {
        const url = new URL(p.url);
        const [_, owner, repo] = url.pathname.split('/');
        return {
          owner,
          repo,
        };
      });

    ghStarsList = await getGithubStars(ghPluginList);
  }

  // Process each plugin
  for (const plugin of communityPlugins) {
    try {
      const existingEntry = store.get<DocEntry['data']>(plugin.name);

      // Determine which stats to use: fresh, cached, or defaults
      let stats: PluginStats;
      if (shouldFetchStats(existingEntry)) {
        // Fetch fresh stats from external sources
        const [_, owner, repo] = new URL(plugin.url).pathname.split('/');
        const repoKey = `${owner}/${repo}`;
        stats = await fetchFreshStats(plugin, repoKey, ghStarsList, true);
        logger.debug(`Fetched fresh stats for ${plugin.name}`);
      } else {
        // Reuse cached stats if available, otherwise use defaults
        stats = getCachedOrDefaultStats(existingEntry, true);
        logger.debug(`Using cached/default stats for ${plugin.name}`);
      }

      // Create and store the plugin entry
      const entry = createCommunityPluginEntry(plugin, stats);
      store.set(entry);
    } catch (err: any) {
      logger.error(`❌ Unable to process plugin ${plugin.name}`);
      logger.error(err.message);
      failedProcessed.add(plugin.name);
    }
  }

  const successCount = communityPlugins.length - failedProcessed.size;
  logger.info(
    `Successfully loaded ${successCount}/${communityPlugins.length} community plugins into store`
  );

  if (!isPluginStatsFetchingEnabled()) {
    logger.info(
      '(Stats fetching disabled - using cached data or defaults. Set NX_DOCS_PLUGIN_STATS=true to fetch fresh stats.)'
    );
  }
}

export function CommunityPluginsLoader(): Loader {
  return {
    name: 'community-plugins-loader',
    async load({ store, logger, watcher }: LoaderContext) {
      const generate = async () => {
        await loadCommunityPluginsData(logger, store);
      };

      if (watcher) {
        // Watch for changes to the loader file and data files
        const pathsToWatch = [
          new URL(import.meta.url).pathname,
          new URL('../content/approved-community-plugins.json', import.meta.url)
            .pathname,
        ];
        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
