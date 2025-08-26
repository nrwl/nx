import { workspaceRoot } from '@nx/devkit';
import type { LoaderContext } from 'astro/loaders';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  getGeneratorsMarkdown,
  getExecutorsMarkdown,
  getMigrationsMarkdown,
} from './generate-plugin-markdown';
import {
  parseGenerators,
  parseExecutors,
  parseMigrations,
} from './plugin-schema-parser';
import {
  getGithubStars,
  shouldFetchStats,
  getNpmDownloads,
  getNpmData,
} from './plugin-stats';
import type { CollectionEntry } from 'astro:content';

// TODO(caleb): make this function not specific to these packages AND work with the plugin.loader.ts file
export async function loadNxSpecialPackage(
  packageName: 'nx' | 'plugin' | 'web' | 'workspace',
  context: LoaderContext
): Promise<CollectionEntry<'nx-reference-packages'>[]> {
  const { logger, renderMarkdown } = context;
  const entries: CollectionEntry<'nx-reference-packages'>[] = [];

  logger.info(`Loading ${packageName} package documentation...`);

  const pluginPath = join(workspaceRoot, 'packages', packageName);

  if (!existsSync(pluginPath)) {
    logger.warn(`Package ${packageName} path does not exist`);
    return [];
  }

  const packageJsonPath = join(pluginPath, 'package.json');
  let packageDescription = `The Nx ${packageName} package`;

  try {
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.description && packageJson.description.trim()) {
        packageDescription = packageJson.description.trim();
      }
    }
  } catch (error) {
    // Fall back to default description
  }

  const ghStarMap = await getGithubStars([{ owner: 'nrwl', repo: 'nx' }]);
  const npmPackageName = packageName === 'nx' ? 'nx' : `@nx/${packageName}`;

  // Create overview entry
  const overviewEntry: CollectionEntry<'nx-reference-packages'> = {
    id: `${packageName}-overview`,
    collection: 'nx-reference-packages',
    data: {
      title: npmPackageName,
      packageType: packageName,
      docType: 'overview',
      description: packageDescription,
      features: [],
      totalDocs: 0,
      githubStars: ghStarMap.get('nrwl/nx')?.stargazers?.totalCount || 0,
    },
  };

  // Process generators
  const generators = parseGenerators(pluginPath);
  if (generators && generators.size > 0) {
    const markdown = getGeneratorsMarkdown(packageName, generators);
    entries.push({
      id: `${packageName}-generators`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Generators`,
        packageType: packageName,
        docType: 'generators',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('generators');
    overviewEntry.data.totalDocs!++;
  }

  // Process executors
  const executors = parseExecutors(pluginPath);
  if (executors && executors.size > 0) {
    const markdown = getExecutorsMarkdown(packageName, executors);
    entries.push({
      id: `${packageName}-executors`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Executors`,
        packageType: packageName,
        docType: 'executors',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('executors');
    overviewEntry.data.totalDocs!++;
  }

  // Process migrations
  const migrations = parseMigrations(pluginPath);
  if (migrations && migrations.size > 0) {
    const markdown = getMigrationsMarkdown(packageName, migrations);
    entries.push({
      id: `${packageName}-migrations`,
      body: markdown,
      // @ts-expect-error - astro types are mismatched bc of auto generated location loading, etc
      rendered: await renderMarkdown(markdown),
      collection: 'nx-reference-packages',
      data: {
        title: `${npmPackageName} Migrations`,
        packageType: packageName,
        docType: 'migrations',
        description: packageDescription,
      },
    });
    overviewEntry.data.features!.push('migrations');
    overviewEntry.data.totalDocs!++;
  }

  // Fetch npm stats if needed
  const existingOverviewEntry = context.store.get<
    CollectionEntry<'nx-reference-packages'>['data']
  >(`${packageName}-overview`);
  if (shouldFetchStats(existingOverviewEntry)) {
    const npmPackage = {
      name: npmPackageName,
      url: `https://github.com/nrwl/nx/tree/master/packages/${packageName}`,
      description: packageDescription,
    };
    const npmDownloads = await getNpmDownloads(npmPackage);
    const npmMeta = await getNpmData(npmPackage);

    overviewEntry.data.npmDownloads = npmDownloads;
    overviewEntry.data.lastPublishedDate = npmMeta.lastPublishedDate;
    overviewEntry.data.lastFetched = new Date();
  }

  entries.push(overviewEntry);

  logger.info(`✅ Loaded ${packageName} package documentation`);
  return entries;
}
