import type {
  StarlightPlugin,
  StarlightUserConfig,
} from '@astrojs/starlight/types';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { workspaceRoot } from '@nx/devkit';
import {
  formatTechnologyLabel,
  getTechnologyCategory,
} from './utils/plugin-mappings';

// Starlight doesn't export these types, so we extract the few we need
type SidebarItem = NonNullable<StarlightUserConfig['sidebar']>[number];
type LabeledSidebarItem = Extract<SidebarItem, { label: string }>;

function getStaticPluginFiles(
  pluginDir: string,
  workspaceRoot: string,
  technologyCategory: string
): SidebarItem[] {
  const staticFiles: SidebarItem[] = [];
  const pluginContentDir = join(
    workspaceRoot,
    'astro-docs',
    'src',
    'content',
    'docs',
    'api',
    'plugins',
    pluginDir
  );

  if (!existsSync(pluginContentDir)) {
    return staticFiles;
  }

  try {
    const files = readdirSync(pluginContentDir, { withFileTypes: true });

    for (const file of files) {
      if (
        file.isFile() &&
        (file.name.endsWith('.md') || file.name.endsWith('.mdx'))
      ) {
        const fileName = basename(file.name, extname(file.name));
        const label = fileName
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        staticFiles.push({
          label,
          slug: `technologies/${technologyCategory}/${pluginDir}/${fileName}`,
        });
      }
    }
  } catch (error) {
    console.warn(`Skipping ${pluginDir}. Issue reading static files:`, error);
  }

  return staticFiles;
}

export function autoPluginSidebarPlugin(): StarlightPlugin {
  return {
    name: 'auto-plugin-sidebar',
    hooks: {
      setup({ config, logger, updateConfig }) {
        logger.info(
          'Setting up auto-plugin-sidebar for Technologies section...'
        );

        // Get all directories in packages (look in parent directory for actual Nx packages)
        const packagesDir = join(workspaceRoot, 'packages');

        if (!existsSync(packagesDir)) {
          throw new Error('Packages directory does not exist: ' + packagesDir);
        }

        try {
          const directories = readdirSync(packagesDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

          // Group plugins by technology category
          const pluginsByTechnology: Record<
            string,
            Array<{ pluginName: string; packageName: string; dir: string }>
          > = {};

          for (const dir of directories) {
            const packageJsonPath = join(packagesDir, dir, 'package.json');

            if (!existsSync(packageJsonPath)) {
              logger.warn(
                `Skipping ${dir} - package.json not found in ${packagesDir}`
              );
              continue;
            }

            const packageJson = JSON.parse(
              readFileSync(packageJsonPath, 'utf-8')
            );
            const packageName = packageJson.name || `@nx/${dir}`;
            logger.info(`Processing plugin: ${packageName} (${dir})`);

            // Only include @nx scoped packages
            if (!packageName.startsWith('@nx/')) {
              logger.warn(
                `Skipping ${dir} - package name does not start with @nx/`
              );
              continue;
            }

            if (packageName === '@nx/devkit') {
              // devkit is special handled elsewhere
              continue;
            }

            // Get technology category for this plugin
            const technologyCategory = getTechnologyCategory(dir);

            if (!pluginsByTechnology[technologyCategory]) {
              pluginsByTechnology[technologyCategory] = [];
            }

            pluginsByTechnology[technologyCategory].push({
              pluginName: dir,
              packageName,
              dir,
            });

            logger.info(
              `Processing plugin: ${packageName} (${dir}) -> ${technologyCategory}`
            );
          }

          // Generate technology sections
          const technologyItems: SidebarItem[] = [];

          for (const [technologyCategory, plugins] of Object.entries(
            pluginsByTechnology
          )) {
            const pluginItems: SidebarItem[] = [];

            for (const { pluginName, packageName, dir } of plugins) {
              const pluginItem = generatePluginSideBarConfig(
                packagesDir,
                dir,
                packageName,
                technologyCategory
              );
              pluginItems.push(pluginItem);
            }

            // Sort plugins within each technology alphabetically
            pluginItems.sort((a, b) => {
              if (isLabeledItem(a) && isLabeledItem(b)) {
                return a.label.localeCompare(b.label);
              }
              return 0;
            });

            // Create technology section
            const technologyLabel = formatTechnologyLabel(technologyCategory);
            technologyItems.push({
              label: technologyLabel,
              collapsed: true,
              items: pluginItems,
            });
          }

          // Sort technologies alphabetically
          technologyItems.sort((a, b) => {
            if (isLabeledItem(a) && isLabeledItem(b)) {
              return a.label.localeCompare(b.label);
            }
            return 0;
          });

          logger.info(
            `Found ${technologyItems.length} technology categories with ${
              Object.values(pluginsByTechnology).flat().length
            } total plugins`
          );

          // Find the Technologies section in the sidebar
          const sidebar = config.sidebar || [];
          const technologiesIndex = sidebar.findIndex(
            (item) =>
              typeof item === 'object' &&
              'label' in item &&
              item.label === 'Technologies'
          );

          if (technologiesIndex !== -1) {
            const technologiesSection = sidebar[technologiesIndex];

            if (
              typeof technologiesSection === 'object' &&
              'items' in technologiesSection
            ) {
              // Replace the empty items array with our generated technology items
              technologiesSection.items = technologyItems;

              updateConfig({ sidebar });
              logger.info(
                `Successfully populated Technologies section with ${technologyItems.length} technology categories`
              );
            }
          } else {
            logger.warn('Technologies section not found in sidebar');
          }
        } catch (error) {
          logger.error(`Error generating plugin sidebar: ${error}`);
        }
      },
    },
  };
}

function generatePluginSideBarConfig(
  packagesDir: string,
  dir: string,
  packageName: string,
  technologyCategory: string
): SidebarItem {
  const pluginDir = join(packagesDir, dir);

  // Check for generators.json, executors.json, and migrations.json
  const hasGenerators = existsSync(join(pluginDir, 'generators.json'));
  const hasExecutors = existsSync(join(pluginDir, 'executors.json'));
  const hasMigrations = existsSync(join(pluginDir, 'migrations.json'));

  // Create sub-items for generated docs and static files
  const subItems: SidebarItem[] = [];

  if (hasGenerators) {
    subItems.push({
      label: 'Generators',
      link: `/technologies/${technologyCategory}/${dir}/generators`,
    });
  }

  if (hasExecutors) {
    subItems.push({
      label: 'Executors',
      link: `/technologies/${technologyCategory}/${dir}/executors`,
    });
  }

  if (hasMigrations) {
    subItems.push({
      label: 'Migrations',
      link: `/technologies/${technologyCategory}/${dir}/migrations`,
    });
  }

  // Add static markdown files from content/docs/api/plugins/<plugin>/
  const staticFiles = getStaticPluginFiles(
    dir,
    workspaceRoot,
    technologyCategory
  );
  subItems.push(...staticFiles);

  if (subItems.length > 0) {
    return {
      // make the names pretty for the sidebar
      label: packageName.replace('@nx/', ''),
      items: subItems,
      collapsed: true,
    };
  }
  // If no sub-items, link directly to the plugin overview
  return {
    // make the names pretty for the sidebar
    label: packageName.replace('@nx/', ''),
    link: `/technologies/${technologyCategory}/${dir}`,
  };
}

function isLabeledItem(item: unknown): item is NonNullable<LabeledSidebarItem> {
  return item != null && typeof item === 'object' && 'label' in item;
}
