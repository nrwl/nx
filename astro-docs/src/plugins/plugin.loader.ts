import { existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { workspaceRoot } from '@nx/devkit';
import {
  getPropertyDefault,
  getPropertyType,
  parseExecutors,
  parseGenerators,
  parseMigrations,
} from './utils/plugin-schema-parser';
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

function generateMigrationItem(
  name: string,
  item: any,
  packageName: string
): string {
  const { config } = item;
  let markdown = `\n#### \`${name}\`\n`;

  if (config.description) {
    markdown += `${config.description}\n\n`;
  }

  return markdown;
}

function generatePackageUpdateItem(item: any): string {
  const { config } = item;
  let markdown = `\n#### Package Updates for ${config.name}\n`;

  if (config.packages && Object.keys(config.packages).length > 0) {
    markdown += `\nThe following packages will be updated:\n\n`;
    markdown += `| Package | Version |\n`;
    markdown += `|---------|----------|\n`;

    for (const [packageName, packageConfig] of Object.entries(
      config.packages
    ) as [string, any][]) {
      markdown += `| \`${packageName}\` | \`${packageConfig.version}\` |\n`;
    }

    markdown += `\n`;
  }

  return markdown;
}

function generateMarkdown(
  pluginName: string,
  items: Map<string, any>,
  docType: 'generators' | 'executors' | 'migrations'
) {
  const packageName = `@nx/${pluginName}`;
  const typeLabel = docType.charAt(0).toUpperCase() + docType.slice(1);

  let markdown = `
  The ${packageName} plugin provides various ${docType} to help you create and configure ${pluginName} projects within your Nx workspace.
Below is a complete reference for all available ${docType} and their options.
`;

  if (docType === 'migrations') {
    // Group migrations by major.minor version
    const versionGroups = new Map<string, Array<{ name: string; item: any }>>();

    for (const [name, item] of items.entries()) {
      const fullVersion = item.config.version || 'unknown';
      // Extract major.minor from version (e.g., "21.2.3-beta.1" -> "21.2")
      const majorMinorMatch = fullVersion.match(/^(\d+)\.(\d+)/);
      const majorMinor = majorMinorMatch
        ? `${majorMinorMatch[1]}.${majorMinorMatch[2]}`
        : fullVersion;

      if (!versionGroups.has(majorMinor)) {
        versionGroups.set(majorMinor, []);
      }
      versionGroups.get(majorMinor)!.push({ name, item });
    }

    // Sort versions by descending order (highest first)
    const sortedVersions = Array.from(versionGroups.keys()).sort((a, b) => {
      // Handle major.minor version comparison
      const parseVersion = (version: string) => {
        const match = version.match(/^(\d+)\.(\d+)/);
        if (!match) return [0, 0];
        return [parseInt(match[1]), parseInt(match[2])];
      };

      const [aMajor, aMinor] = parseVersion(a);
      const [bMajor, bMinor] = parseVersion(b);

      // Compare major, minor in descending order
      if (bMajor !== aMajor) return bMajor - aMajor;
      if (bMinor !== aMinor) return bMinor - aMinor;

      // If versions are equal, fall back to string comparison
      return b.localeCompare(a);
    });

    for (const version of sortedVersions) {
      const items = versionGroups.get(version)!;
      markdown += `\n## ${version}.x\n`;

      // Combine all items without sub-headers
      const generators = items.filter(({ item }) => item.type === 'generator');
      const packageUpdates = items.filter(
        ({ item }) => item.type === 'packageJsonUpdate'
      );

      // Add generators first
      for (const { name, item } of generators) {
        markdown += generateMigrationItem(name, item, packageName);
      }

      // Add package updates
      for (const { item } of packageUpdates) {
        markdown += generatePackageUpdateItem(item);
      }
    }

    return markdown;
  }

  // Sort items alphabetically for non-migration types
  const sortedItems = Array.from(items.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [name, { config, schema }] of sortedItems) {
    const fullItemName = `${packageName}:${name}`;

    markdown += `
### \`${name}\`
`;

    if (schema?.description || config?.description) {
      markdown += `${schema?.description || config?.description}\n\n`;
    }

    if (docType === 'generators') {
      markdown += `**Usage:**
\`\`\`bash
nx generate ${fullItemName} [options]
\`\`\`
`;
    } else if (docType === 'executors') {
      markdown += `**Usage:**
\`\`\`bash
nx run project:${name} [options]
\`\`\`
`;
    }

    if (config?.aliases && config.aliases.length > 0) {
      markdown += `
**Aliases:** ${config.aliases.map((a: string) => `\`${a}\``).join(', ')}
`;
    }

    if (!schema) continue;

    // Positional arguments (usually the first required property)
    const required = schema.required || [];
    const properties = schema.properties || {};

    // Check for properties with $default.$source === 'argv'
    const positionalArgs: string[] = [];
    for (const [propName, prop] of Object.entries(properties) as [
      string,
      any
    ][]) {
      if (
        prop.$default &&
        prop.$default.$source === 'argv' &&
        typeof prop.$default.index === 'number'
      ) {
        positionalArgs[prop.$default.index] = propName;
      }
    }

    if (positionalArgs.length > 0 && docType === 'generators') {
      markdown += `
**Arguments:**
\`\`\`bash
nx generate ${fullItemName} ${positionalArgs
        .map((arg) => `<${arg}>`)
        .join(' ')} [options]
\`\`\`
`;
    }

    if (Object.keys(properties).length > 0) {
      markdown += `
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|`;

      // Sort properties alphabetically, but put required ones first
      const sortedProperties = Object.entries(properties).sort(([a], [b]) => {
        const aRequired = required.includes(a);
        const bRequired = required.includes(b);

        if (aRequired && !bRequired) return -1;
        if (!aRequired && bRequired) return 1;

        return a.localeCompare(b);
      });

      for (const [propName, property] of sortedProperties as [string, any][]) {
        // Skip positional arguments from the options table
        if (positionalArgs.includes(propName)) {
          continue;
        }

        const type = getPropertyType(property);
        const description = property.description || '';
        const defaultValue = getPropertyDefault(property);
        const isRequired = required.includes(propName);

        let optionName = `\`--${propName}\``;

        if (isRequired) {
          optionName += '[**required**]';
        }

        markdown += `\n| ${optionName} | ${type} | ${description} | ${defaultValue} |`;
      }

      markdown += '\n';
    }

    if (docType === 'generators') {
      markdown += `
## Getting Help

You can get help for any generator by adding the \`--help\` flag:

\`\`\`bash
nx generate ${packageName}:<generator> --help
\`\`\`
`;
    } else if (docType === 'executors') {
      markdown += `
## Getting Help

You can get help for any executor by adding the \`--help\` flag:

\`\`\`bash
nx run project:${docType} --help
\`\`\`
`;
    }
  }

  return markdown;
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
  renderMarkdown: (content: string) => Promise<RenderedContent>
): Promise<DocEntry[]> {
  logger.info('Generating plugin documentation...');
  const entries: DocEntry[] = [];
  let successCount = 0;
  let skipCount = 0;

  for (const relativePath of PLUGIN_PATHS) {
    const pluginPath = join(workspaceRoot, 'packages', relativePath);

    if (!existsSync(pluginPath)) {
      logger.warn(`⚠️  Skipping ${relativePath} - path does not exist`);
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
        const markdown = generateMarkdown(pluginName, generators, 'generators');
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
        const markdown = generateMarkdown(pluginName, executors, 'executors');
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
        const markdown = generateMarkdown(pluginName, migrations, 'migrations');
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
        ];
        watchAndCall(watcher, pathsToWatch, generate);
      }

      await generate();
    },
  };
}
