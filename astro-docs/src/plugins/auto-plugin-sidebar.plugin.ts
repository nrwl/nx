import type {
  StarlightPlugin,
  StarlightUserConfig,
} from '@astrojs/starlight/types';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { workspaceRoot } from '@nx/devkit';

// Starlight doesn't export these types, so we extract the few we need
type SidebarItem = NonNullable<StarlightUserConfig['sidebar']>[number];

function getStaticPluginFiles(
  pluginDir: string,
  workspaceRoot: string
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
          slug: `api/plugins/${pluginDir}/${fileName}`,
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
        logger.info('Setting up auto-plugin-sidebar...');

        // Get all directories in packages (look in parent directory for actual Nx packages)
        const packagesDir = join(workspaceRoot, 'packages');

        if (!existsSync(packagesDir)) {
          throw new Error('Packages directory does not exist: ' + packagesDir);
        }

        const pluginItems: SidebarItem[] = [];

        try {
          const directories = readdirSync(packagesDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

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

            // Only include @nx scoped packages
            if (!packageName.startsWith('@nx/')) {
              logger.warn(
                `Skipping ${dir} - package name does not start with @nx/`
              );
              continue;
            }

            if (packageName === '@nx/devkit') {
              // devkit is special handled
              continue;
            }

            logger.info(`Processing plugin: ${packageName} (${dir})`);
            const item = generatePluginSideBarConfig(
              packagesDir,
              dir,
              packageName
            );
            pluginItems.push(item);
          }

          logger.info(`Found ${pluginItems.length} plugins`);

          // Find the API Reference section in the sidebar
          const sidebar = config.sidebar || [];
          const apiRefIndex = sidebar.findIndex(
            (item) =>
              typeof item === 'object' &&
              'label' in item &&
              item.label === 'References'
          );

          if (apiRefIndex !== -1) {
            const apiRefSection = sidebar[apiRefIndex];

            if (typeof apiRefSection === 'object' && 'items' in apiRefSection) {
              apiRefSection.items.push(...pluginItems);

              // NOTE: there are already some hard defined references in the astro config. such as devkit (plugin doc w/ children items)
              //  and the cli docs (no children items)
              //  those that do not have children items need to be sorted alphabetically
              //  the others will remain in place at the top of the reference section
              apiRefSection.items.sort((a, b) => {
                if (
                  typeof a === 'string' ||
                  typeof b === 'string' ||
                  !('items' in a) ||
                  !('items' in b)
                ) {
                  return 0;
                } else {
                  return a.label.localeCompare(b.label);
                }
              });

              updateConfig({ sidebar });
              logger.info(
                `Successfully added ${pluginItems.length} plugins directly to API Reference`
              );
            }
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
  packageName: string
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
      link: `/api/plugins/${dir}/generators`,
    });
  }

  if (hasExecutors) {
    subItems.push({
      label: 'Executors',
      link: `/api/plugins/${dir}/executors`,
    });
  }

  if (hasMigrations) {
    subItems.push({
      label: 'Migrations',
      link: `/api/plugins/${dir}/migrations`,
    });
  }

  // Add static markdown files from content/docs/api/plugins/<plugin>/
  const staticFiles = getStaticPluginFiles(dir, workspaceRoot);
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
    link: `/api/plugins/${dir}`,
  };
}
