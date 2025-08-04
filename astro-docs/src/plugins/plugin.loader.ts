import { existsSync, readFileSync } from 'fs';
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
import { watchAndCall } from './utils/watch.ts';

// TODO: make this a glob pattern or something so we don't have to manually update
// Define the plugins to generate documentation for
const PLUGIN_PATHS = [
  'cypress',
  'react',
  'next',
  'angular',
  'vue',
  'vite',
  'webpack',
  'jest',
  'eslint',
  'storybook',
  'playwright',
  'rollup',
  'esbuild',
  'rspack',
  'remix',
  'expo',
  'react-native',
  'detox',
  'express',
  'nest',
  'node',
  'js',
  'web',
  'workspace',
  'nx',
  'plugin',
  'nuxt',
  'gradle',
];

type DocEntry = CollectionEntry<'plugin-docs'>;

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
  renderMarkdown: (content: string) => Promise<RenderedContent>
): Promise<DocEntry[]> {
  logger.info('Generating plugin documentation...');
  const entries: DocEntry[] = [];
  let successCount = 0;
  let skipCount = 0;

  for (const relativePath of PLUGIN_PATHS) {
    const pluginPath = join(workspaceRoot, 'packages', relativePath);

    if (!existsSync(pluginPath)) {
      logger.warn(`Skipping ${relativePath} - path does not exist`);
      skipCount++;
      continue;
    }
    watcher?.add(pluginPath);

    // Extract plugin name from path
    const pluginName = relativePath.split('/').pop() || '';

    // Get plugin description from package.json
    const pluginDescription = getPluginDescription(pluginPath, pluginName);

    try {
      // Process generators
      const generators = parseGenerators(pluginPath);
      if (generators && generators.size > 0) {
        const markdown = getGeneratorsMarkdown(pluginName, generators);
        entries.push({
          id: `${pluginName}-generators`,
          body: markdown,
          collection: 'plugin-docs',
          rendered: await renderMarkdown(markdown),
          data: {
            title: `@nx/${pluginName} Generators`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'generators',
            description: pluginDescription,
          },
        });
      }

      // Process executors
      const executors = parseExecutors(pluginPath);
      if (executors && executors.size > 0) {
        const markdown = getExecutorsMarkdown(pluginName, executors);
        entries.push({
          id: `${pluginName}-executors`,
          body: markdown,
          collection: 'plugin-docs',
          rendered: await renderMarkdown(markdown),
          data: {
            title: `@nx/${pluginName} Executors`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'executors',
            description: pluginDescription,
          },
        });
      }

      // Process migrations
      const migrations = parseMigrations(pluginPath);
      if (migrations && migrations.size > 0) {
        const markdown = getMigrationsMarkdown(pluginName, migrations);
        entries.push({
          id: `${pluginName}-migrations`,
          body: markdown,
          collection: 'plugin-docs',
          rendered: await renderMarkdown(markdown),
          data: {
            title: `@nx/${pluginName} Migrations`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'migrations',
            description: pluginDescription,
          },
        });
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
  }
  return entries;
}

export function PluginLoader(options: any = {}): Loader {
  return {
    name: 'nx-plugin-loader',
    async load({ store, logger, watcher, renderMarkdown }: LoaderContext) {
      const generate = async () => {
        store.clear();
        const docs = await generateAllPluginDocs(
          logger,
          watcher,
          // @ts-expect-error - astro:content types seem to always be out of sync w/ generated types
          renderMarkdown
        );
        docs.forEach(store.set);
        logger.info(
          `Generated plugin documentation with ${docs.length} entries`
        );
      };

      if (watcher) {
        const pathsToWatch = [
          join(import.meta.dirname, 'plugin.loader.ts'),
          join(import.meta.dirname, 'utils', 'plugin-schema-parser.ts'),
          join(import.meta.dirname, 'utils', 'get-schema-example-content.ts'),
        ];
        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
