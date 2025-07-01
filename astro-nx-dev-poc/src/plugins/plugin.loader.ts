import { existsSync } from 'fs';
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

## Available ${typeLabel}
`;

  // Sort items alphabetically
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

    try {
      // Process generators
      const generators = parseGenerators(pluginPath);
      if (generators && generators.size > 0) {
        const markdown = generateMarkdown(pluginName, generators, 'generators');
        entries.push({
          id: `${pluginName}-generators`,
          body: markdown,
          filePath: relative(
            join(workspaceRoot, 'astro-nx-dev-poc'),
            join(pluginPath, 'generators.json')
          ),
          collection: 'plugin-docs',
          rendered: await renderMarkdown(markdown),
          data: {
            title: `@nx/${pluginName} Generators`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'generators',
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
          filePath: relative(
            join(workspaceRoot, 'astro-nx-dev-poc'),
            join(pluginPath, 'executors.json')
          ),
          collection: 'plugin-docs',
          rendered: await renderMarkdown(markdown),
          data: {
            title: `@nx/${pluginName} Executors`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'executors',
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
          filePath: relative(
            join(workspaceRoot, 'astro-nx-dev-poc'),
            join(pluginPath, 'migration.json')
          ),
          data: {
            title: `@nx/${pluginName} Migrations`,
            pluginName,
            packageName: `@nx/${pluginName}`,
            docType: 'migrations',
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
      store.clear();
      // @ts-expect-error - astro:content types seem to always be out of sync w/ generated types
      const docs = await generateAllPluginDocs(logger, watcher, renderMarkdown);
      docs.forEach(store.set);
      logger.info(`Generated plugin documentation with ${docs.length} entries`);
    },
  };
}
