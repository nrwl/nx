import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { workspaceRoot } from '@nx/devkit';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import frontMatter from 'front-matter';

/**
 * Map of plugins names to their technology grouping
 */
export const pluginToTechnology: Record<string, string> = {
  typescript: 'typescript',
  js: 'typescript',

  angular: 'angular',
  'angular-rspack': 'angular',
  'angular-rsbuild': 'angular',

  react: 'react',
  next: 'react',
  remix: 'react',
  'react-native': 'react',
  expo: 'react',

  vue: 'vue',
  nuxt: 'vue',

  node: 'node',
  express: 'node',
  nest: 'node',

  java: 'java',
  gradle: 'java',
  maven: 'java',

  'module-federation': 'module-federation',

  eslint: 'eslint',
  'eslint-plugin': 'eslint',

  webpack: 'build-tools',
  vite: 'build-tools',
  rollup: 'build-tools',
  esbuild: 'build-tools',
  rspack: 'build-tools',
  rsbuild: 'build-tools',
  docker: 'build-tools',

  cypress: 'test-tools',
  jest: 'test-tools',
  playwright: 'test-tools',
  storybook: 'test-tools',
  detox: 'test-tools',
};

/**
 * Get technology category for a given plugin name
 * @param pluginName The plugin name (e.g., 'react', 'next', 'webpack')
 * @returns Technology category (e.g., 'react', 'build-tools') or 'other' if not found
 */
export function getTechnologyCategory(pluginName: string): string {
  return pluginToTechnology[pluginName];
}

/**
 * Get all plugins that belong to a specific technology category
 * @param technologyCategory The technology category (e.g., 'react', 'build-tools')
 * @returns Array of plugin names in that category
 */
export function getPluginsInTechnology(technologyCategory: string): string[] {
  return Object.entries(pluginToTechnology)
    .filter(([_, category]) => category === technologyCategory)
    .map(([pluginName, _]) => pluginName);
}

/**
 * Get all unique technology categories
 * @returns Array of all technology category names
 */
export function getAllTechnologyCategories(): string[] {
  return Array.from(new Set(Object.values(pluginToTechnology))).sort();
}

type SidebarItem = NonNullable<StarlightUserConfig['sidebar']>[number];
type SidebarSubItem = Extract<SidebarItem, { items: any[] }>;

const pluginBasePath = join(workspaceRoot, 'packages');
/**
 * get all the linkable pages for a given plugin for the sidebar
 */
export function getPluginItems(
  plugin: string,
  technologyCategory?: string
): SidebarSubItem[] {
  const pluginPath = join(pluginBasePath, plugin);
  if (!existsSync(pluginPath)) {
    throw new Error(
      `Plugin base path does not exist: ${pluginBasePath} for plugin ${plugin} in category ${technologyCategory}`
    );
  }

  if (!lstatSync(pluginPath).isDirectory()) {
    throw new Error(`Plugin base path is not a directory: ${pluginBasePath}`);
  }

  const packageJsonPath = join(pluginPath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json does not exist: ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (!packageJson.name) {
    throw new Error(`package.json does not have a name: ${packageJsonPath}`);
  }
  const items: SidebarItem[] = [];

  // NOTE: some docs are at the top level of a category, so the route needs to reflect that
  const baseUrl = technologyCategory
    ? `/technologies/${technologyCategory}/${plugin}`
    : `/technologies/${plugin}`;

  if (hasValidConfig(pluginPath, 'generators')) {
    items.push({
      label: 'Generators',
      link: `${baseUrl}/generators`,
    });
  }

  if (hasValidConfig(pluginPath, 'executors')) {
    items.push({
      label: 'Executors',
      link: `${baseUrl}/executors`,
    });
  }

  if (hasValidConfig(pluginPath, 'migrations')) {
    items.push({
      label: 'Migrations',
      link: `${baseUrl}/migrations`,
    });
  }

  // TODO: when moving from `astro-docs` this path will need to also be updated
  const staticFiles = getStaticPluginFiles(
    join(workspaceRoot, 'astro-docs', 'src', 'content', 'docs', baseUrl)
  );

  if (staticFiles.length > 0) {
    items.push(...staticFiles);
  }

  // @ts-expect-error - idk I'll figure out to type it
  return items;
}

function hasValidConfig(
  pluginPath: string,
  type: 'executors' | 'generators' | 'migrations'
): boolean {
  const configPath = join(pluginPath, `${type}.json`);

  if (!existsSync(configPath)) {
    return false;
  }

  const content = JSON.parse(readFileSync(configPath, 'utf-8'));

  if (type === 'executors') {
    if (
      !content.executors ||
      typeof content.executors !== 'object' ||
      Object.keys(content.executors).length === 0
    ) {
      // have file, but no generators configured
      return false;
    }
    return true;
  }

  // migrations can be generators or packageJsonUpdates
  const hasGenerators =
    content.generators &&
    typeof content.generators === 'object' &&
    Object.keys(content.generators).length > 0;

  const hasPackageJsonUpdates =
    content.packageJsonUpdates &&
    typeof content.packageJsonUpdates === 'object' &&
    Object.keys(content.packageJsonUpdates).length > 0;

  return hasGenerators || hasPackageJsonUpdates;
}

/**
 * Extract label from frontmatter with fallback priority:
 * 1. sidebar.label
 * 2. title
 * 3. filename (fallback)
 */
function extractLabelFromFile(filePath: string, fileName: string): string {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const parsed = frontMatter<{
      title?: string;
      sidebar?: { label?: string };
    }>(fileContent);

    // Priority 1: sidebar.label
    if (parsed.attributes?.sidebar?.label) {
      return parsed.attributes.sidebar.label;
    }

    // Priority 2: title
    if (parsed.attributes?.title) {
      return parsed.attributes.title;
    }
  } catch (error) {
    // If parsing fails, fall back to filename
    console.warn(`Failed to parse frontmatter for ${filePath}:`, error);
  }

  // Priority 3: filename (fallback)
  return fileName;
}

function getStaticPluginFiles(pluginContentDir: string): SidebarItem[] {
  const staticFiles: SidebarItem[] = [];

  if (!existsSync(pluginContentDir)) {
    return staticFiles;
  }

  try {
    const baseUrl = pluginContentDir.split(`/technologies/`).pop();

    // Recursive function to process directories and build nested structure
    function processDirectory(
      dirPath: string,
      relativePath: string = ''
    ): SidebarItem[] {
      const items: SidebarItem[] = [];
      const files = readdirSync(dirPath, { withFileTypes: true });

      // Sort to ensure consistent ordering (directories first, then files)
      files.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const file of files) {
        const fullPath = join(dirPath, file.name);

        if (file.isDirectory()) {
          // Process subdirectory recursively
          const newRelativePath = relativePath
            ? `${relativePath}/${file.name}`
            : file.name;
          const subItems = processDirectory(fullPath, newRelativePath);

          // Only add the directory group if it contains items
          if (subItems.length > 0) {
            items.push({
              label: file.name,
              items: subItems,
            } as SidebarSubItem);
          }
        } else if (
          file.isFile() &&
          (file.name.endsWith('.md') ||
            file.name.endsWith('.mdx') ||
            file.name.endsWith('.mdoc'))
        ) {
          const fileName = basename(file.name, extname(file.name));
          const fileSlug = fileName.split(' ').join('-').toLowerCase();

          // Build the full slug including the relative path
          const fullSlug = relativePath
            ? `technologies/${baseUrl}/${relativePath}/${fileSlug}`
            : `technologies/${baseUrl}/${fileSlug}`;

          // Extract label from frontmatter with fallback priority
          const label = extractLabelFromFile(fullPath, fileName);

          items.push({
            label: label,
            slug: fullSlug.toLowerCase(),
          });
        }
      }

      return items;
    }

    // Start processing from the root plugin content directory
    return processDirectory(pluginContentDir);
  } catch (error) {
    console.warn(
      `Skipping ${pluginContentDir}. Issue reading static files:`,
      error
    );
  }

  return staticFiles;
}
