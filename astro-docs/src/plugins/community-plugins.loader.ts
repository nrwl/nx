import type { Loader, LoaderContext } from 'astro/loaders';
import { watchAndCall } from './utils/watch';
import communityPlugins from '../content/approved-community-plugins.json';
import type { CollectionEntry } from 'astro:content';
import {
  getGithubStars,
  getNpmData,
  getNpmDownloads,
  shouldFetchStats,
} from './utils/plugin-stats';

type DocEntry = CollectionEntry<'community-plugins'>;

async function loadCommunityPluginsData(
  logger: LoaderContext['logger'],
  store: LoaderContext['store']
): Promise<void> {
  logger.info('Loading community plugins data...');

  const failedProcessed = new Set<string>();

  // NOTE: GH gql api allows us to get all plugin meta in one call
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

  const ghStarsList = await getGithubStars(ghPluginList);

  for (const plugin of communityPlugins) {
    const existingEntry = store.get<DocEntry['data']>(plugin.name);
    // re-hydrate if the plugins last publish date is > 1 week old, just to be safe
    // we could use digests but those still require fetching the data to compare against.Date

    if (!shouldFetchStats(existingEntry)) {
      logger.debug(
        `Skipping ${plugin.name} as it's data is already recently fetched`
      );
      continue;
    }

    try {
      const npmMeta = await getNpmData(plugin);
      const npmDownloads = await getNpmDownloads(plugin);
      const [_, owner, repo] = new URL(plugin.url).pathname.split('/');

      const entry: DocEntry = {
        id: plugin.name,
        collection: 'community-plugins',
        data: {
          title: plugin.name,
          slug: plugin.name,
          description: plugin.description,
          url: plugin.url,
          lastPublishedDate: npmMeta.lastPublishedDate,
          npmDownloads: npmDownloads,
          githubStars:
            ghStarsList.get(`${owner}/${repo}`)?.stargazers?.totalCount ?? 0,
          nxVersion: npmMeta.nxVersion,
          lastFetched: new Date(),
        },
      };

      store.set(entry);
    } catch (err: any) {
      logger.error(`❌ Unable to process plugin ${plugin.name}`);
      logger.error(err.message);
      failedProcessed.add(plugin.name);
    }
  }

  const successCount = communityPlugins.length - failedProcessed.size;
  logger.info(
    `Successfully loaded ${successCount} community plugins into store`
  );
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
