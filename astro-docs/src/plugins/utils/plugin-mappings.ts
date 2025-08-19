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

  // JS plugin is refed as typescript, so for now we remap it, but might be others we need to do this for
  // down the road
  const remappedPluginName = plugin === 'js' ? 'typescript' : plugin;
  // NOTE: some docs are at the top level of a category, so the route needs to reflect that
  const baseUrl = technologyCategory
    ? `/technologies/${technologyCategory}/${remappedPluginName}`
    : `/technologies/${remappedPluginName}`;

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

  // Separate static files into categories
  let introItem: SidebarItem | undefined;
  let guidesItem: SidebarItem | undefined;
  const otherStaticFiles: SidebarItem[] = [];
  
  if (staticFiles.length > 0) {
    for (const file of staticFiles) {
      // Check for Introduction
      // @ts-ignore - accessing properties
      const isIntro = file.label === 'Introduction' || 
                     (file.slug && typeof file.slug === 'string' && file.slug.endsWith('/introduction'));
      
      if (isIntro) {
        introItem = file;
      // Check for Guides folder (must be specifically named "Guides" and have items)
      // @ts-ignore - accessing properties  
      } else if (file.label === 'Guides' && file.items && Array.isArray(file.items)) {
        guidesItem = file;
      } else {
        otherStaticFiles.push(file);
      }
    }
  }

  // Build final items array with proper ordering:
  // 1. Introduction (if exists)
  // 2. Guides (if exists)
  // 3. Generators (if exists)
  // 4. Executors (if exists)
  // 5. Migrations (if exists)
  // 6. Everything else
  const finalItems: SidebarItem[] = [];
  
  // 1. Add Introduction first if it exists
  if (introItem) {
    finalItems.push(introItem);
  }
  
  // 2. Add Guides second if it exists
  if (guidesItem) {
    finalItems.push(guidesItem);
  }
  
  // 3-5. Add generated items (Generators, Executors, Migrations) - they're already in correct order in 'items'
  finalItems.push(...items);
  
  // 6. Finally add other static files (nested sections, other items)
  finalItems.push(...otherStaticFiles);

  // @ts-expect-error - idk I'll figure out to type it
  return finalItems;
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
    return (
      content.executors &&
      typeof content.executors === 'object' &&
      Object.keys(content.executors).length > 0
    );
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
    // eg. "/technologies/build-tools/esbuild/introduction.mdoc" -> "build-tools/esbuild/introdumentation.mdoc"
    const baseUrl = pluginContentDir.split(`/technologies/`).pop();

    // Get all plugin names to check against subdirectories
    const allPluginNames = Object.keys(pluginToTechnology);

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
          // Skip this directory if it's the name of another plugin
          if (allPluginNames.includes(file.name)) {
            continue;
          }

          // Process subdirectory recursively
          const newRelativePath = relativePath
            ? `${relativePath}/${file.name}`
            : file.name;
          const subItems = processDirectory(fullPath, newRelativePath);

          // Only add the directory group if it contains items
          if (subItems.length > 0) {
            // Check if there's an index.mdoc file in this directory
            const indexPath = join(fullPath, 'index.mdoc');
            const hasIndex = existsSync(indexPath);

            // For directories with content, add them as a group
            // If there's an index.mdoc, we'll use its title for the label
            if (hasIndex) {
              const label = extractLabelFromFile(indexPath, file.name);

              items.push({
                label: label,
                items: subItems,
              } as SidebarSubItem);
            } else {
              items.push({
                label: file.name,
                items: subItems,
              } as SidebarSubItem);
            }
          }
        } else if (
          file.isFile() &&
          (file.name.endsWith('.md') ||
            file.name.endsWith('.mdx') ||
            file.name.endsWith('.mdoc'))
        ) {
          const fileName = basename(file.name, extname(file.name));

          // Skip index files as they're handled by directory processing
          if (fileName === 'index') {
            continue;
          }

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
