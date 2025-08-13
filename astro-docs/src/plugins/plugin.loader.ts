import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';
import {
  parseExecutors,
  parseGenerators,
  parseMigrations,
} from './utils/plugin-schema-parser';
import {
  getExecutorsMarkdown,
  getGeneratorsMarkdown,
  getMigrationsMarkdown,
} from './utils/generate-plugin-markdown';
import type { Loader, LoaderContext } from 'astro/loaders';
import type { CollectionEntry, RenderedContent } from 'astro:content';
import { watchAndCall } from './utils/watch';
import {
  getGithubStars,
  getNpmData,
  getNpmDownloads,
  PLUGIN_IGNORE_LIST,
  shouldFetchStats,
} from './utils/plugin-stats';
import {
  getTechnologyCategory,
  pluginToTechnology,
} from './utils/plugin-mappings';

const PLUGIN_PATHS = readdirSync(join(workspaceRoot, 'packages'));

type DocEntry = CollectionEntry<'plugin-docs'>;

/**
 * Generate the URL slug for a plugin document
 * @param pluginName The plugin name (e.g., 'react', 'next', 'webpack')
 * @param docType The document type (e.g., 'generators', 'executors', 'migrations')
 * @returns The URL slug or null if this is a special package handled elsewhere
 */
function getPluginSlug(pluginName: string, docType: string) {
  // Special packages are handled by nx-reference-packages.loader
  if (['nx', 'devkit', 'plugin', 'web', 'workspace'].includes(pluginName)) {
    return '';
  }

  const category = getTechnologyCategory(pluginName);

  // Apply the same remapping logic used in sidebar generation
  // JS plugin is referenced as typescript, so we remap it to match the URL structure
  const remappedPluginName = pluginName === 'js' ? 'typescript' : pluginName;

  // plugin is the top level tech, then we make the docs on the top level too
  if (remappedPluginName === category) {
    return `technologies/${remappedPluginName}/${docType}`;
  }
  return `technologies/${category}/${remappedPluginName}/${docType}`;
}

function getPluginDescription(pluginPath: string, pluginName: string): string {
  const packageJsonPath = join(pluginPath, 'package.json');

  try {
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.description && packageJson.description.trim()) {
        return packageJson.description.trim();
      }
    }
  } catch (error) {
    // If we can't read the package.json, fall back to default
  }

  return `The Nx Plugin for ${pluginName}`;
}

export async function generateAllPluginDocs(
  logger: LoaderContext['logger'],
  watcher: LoaderContext['watcher'],
  renderMarkdown: (content: string) => Promise<RenderedContent>,
  store: LoaderContext['store']
) {
  logger.info('Generating plugin documentation...');
  const entries: DocEntry[] = [];
  let successCount = 0;
  let skipCount = 0;

  const ghStarMap = await getGithubStars([{ owner: 'nrwl', repo: 'nx' }]);

  for (const relativePath of PLUGIN_PATHS) {
    const pluginPath = join(workspaceRoot, 'packages', relativePath);

    if (!existsSync(pluginPath)) {
      logger.warn(`Skipping ${relativePath} - path does not exist`);
      skipCount++;
      continue;
    }

    const pluginName = relativePath.split('/').pop() || '';
    if (PLUGIN_IGNORE_LIST.includes(pluginName)) {
      logger.warn(`Skipping ${pluginName} - listed as ignored plugin`);
      skipCount++;
      continue;
    }

    // Skip special packages that are handled by nx-reference-packages.loader
    if (['nx', 'devkit', 'plugin', 'web', 'workspace'].includes(pluginName)) {
      logger.info(
        `Skipping ${pluginName} - handled by nx-reference-packages.loader`
      );
      skipCount++;
      continue;
    }

    watcher?.add(pluginPath);
    // Get plugin description from package.json
    const pluginDescription = getPluginDescription(pluginPath, pluginName);

    const existingOverviewEntry = store.get<DocEntry['data']>(
      `${pluginName}-overview`
    );
    // special case for the main Nx package
    const packageName = pluginName === 'nx' ? 'nx' : `@nx/${pluginName}`;

    // Get technology category for this plugin
    const technologyCategory = getTechnologyCategory(pluginName);

    let pluginOverview = {} as DocEntry;

    if (shouldFetchStats(existingOverviewEntry)) {
      const npmPackage = {
        name: packageName,
        url: `https://github.com/nrwl/nx/tree/master/packages/${pluginName}`,
        description: pluginDescription,
      };
      const npmDownloads = await getNpmDownloads(npmPackage);
      const npmMeta = await getNpmData(npmPackage);
      const slug = (pluginOverview = {
        id: `${pluginName}-overview`,
        collection: 'plugin-docs',
        data: {
          description: pluginDescription,
          packageName,
          pluginName,
          technologyCategory,
          features: [],
          totalDocs: 0,
          docType: 'overview',
          githubStars: ghStarMap.get('nrwl/nx')?.stargazers?.totalCount || 0,
          npmDownloads: npmDownloads,
          lastPublishedDate: npmMeta.lastPublishedDate,
          lastFetched: new Date(),
          title: '',
          slug: getPluginSlug(pluginName, 'introduction'),
        },
      });
    } else {
      pluginOverview = existingOverviewEntry as DocEntry;
    }

    try {
      // Process generators
      const generators = parseGenerators(pluginPath);
      if (generators && generators.size > 0) {
        const markdown = getGeneratorsMarkdown(pluginName, generators);
        const slug = getPluginSlug(pluginName, 'generators');
        if (slug) {
          store.set({
            id: `${pluginName}-generators`,
            body: markdown,
            rendered: await renderMarkdown(markdown),
            data: {
              title: `@nx/${pluginName} Generators`,
              pluginName,
              packageName: `@nx/${pluginName}`,
              technologyCategory,
              docType: 'generators',
              description: pluginDescription,
              slug,
            },
          });
        }

        if (slug) {
          pluginOverview.data.features!.push('generators');
          pluginOverview.data.totalDocs!++;
        }
      }

      // Process executors
      const executors = parseExecutors(pluginPath);
      if (executors && executors.size > 0) {
        const markdown = getExecutorsMarkdown(pluginName, executors);
        const slug = getPluginSlug(pluginName, 'executors');
        if (slug) {
          store.set({
            id: `${pluginName}-executors`,
            body: markdown,
            rendered: await renderMarkdown(markdown),
            data: {
              title: `@nx/${pluginName} Executors`,
              pluginName,
              packageName: `@nx/${pluginName}`,
              technologyCategory,
              docType: 'executors',
              description: pluginDescription,
              slug,
            },
          });
        }
        if (slug) {
          pluginOverview.data.features!.push('executors');
          pluginOverview.data.totalDocs!++;
        }
      }

      // Process migrations
      const migrations = parseMigrations(pluginPath);
      if (migrations && migrations.size > 0) {
        const markdown = getMigrationsMarkdown(pluginName, migrations);
        const slug = getPluginSlug(pluginName, 'migrations');
        if (slug) {
          store.set({
            id: `${pluginName}-migrations`,
            body: markdown,
            rendered: await renderMarkdown(markdown),
            data: {
              title: `@nx/${pluginName} Migrations`,
              pluginName,
              packageName: `@nx/${pluginName}`,
              technologyCategory,
              docType: 'migrations',
              description: pluginDescription,
              slug,
            },
          });
        }
        if (slug) {
          pluginOverview.data.features!.push('migrations');
          pluginOverview.data.totalDocs!++;
        }
      }

      if (generators?.size || executors?.size || migrations?.size) {
        logger.info(`✅ Generated documentation for ${pluginName}`);
        successCount++;
      } else {
        logger.warn(
          `⚠️  Skipping ${pluginName} - no visible documentation found`
        );
        skipCount++;
      }
    } catch (error: any) {
      logger.error(`❌ Error processing ${pluginName}: ${error.message}`);
      skipCount++;
    }
    store.set(pluginOverview);
  }
}

export function PluginLoader(options: any = {}): Loader {
  return {
    name: 'nx-plugin-loader',
    async load({ store, logger, watcher, renderMarkdown }: LoaderContext) {
      const generate = async () => {
        await generateAllPluginDocs(
          logger,
          watcher,
          // @ts-expect-error - astro:content types seem to always be out of sync w/ generated types
          renderMarkdown,
          store
        );
      };

      if (watcher) {
        const pathsToWatch = [
          join(import.meta.dirname, 'plugin.loader.ts'),
          join(import.meta.dirname, 'utils', 'plugin-schema-parser.ts'),
          join(import.meta.dirname, 'utils', 'get-schema-example-content.ts'),
          join(import.meta.dirname, 'utils', 'plugin-mappings.ts'),
          join(import.meta.dirname, '..', '..', 'sidebar.mts'),
        ];
        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
