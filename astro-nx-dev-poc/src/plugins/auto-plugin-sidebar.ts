import type { StarlightPlugin } from '@astrojs/starlight/types';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '@nx/devkit';

export function autoPluginSidebar(): StarlightPlugin {
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

        const pluginItems: Array<{
          label: string;
          link?: string;
          items?: any[];
        }> = [];

        try {
          const directories = readdirSync(packagesDir, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);

          // Check each directory for a package.json
          for (const dir of directories) {
            const packageJsonPath = join(packagesDir, dir, 'package.json');

            if (existsSync(packageJsonPath)) {
              logger.info(`Processing plugin: ${dir} for sidebar`);
              try {
                const packageJson = JSON.parse(
                  readFileSync(packageJsonPath, 'utf-8')
                );
                const packageName = packageJson.name || `@nx/${dir}`;

                // Only include @nx scoped packages
                if (packageName.startsWith('@nx/')) {
                  const pluginDir = join(packagesDir, dir);

                  // Check for generators.json, executors.json, and migrations.json
                  const hasGenerators = existsSync(
                    join(pluginDir, 'generators.json')
                  );
                  const hasExecutors = existsSync(
                    join(pluginDir, 'executors.json')
                  );
                  const hasMigrations = existsSync(
                    join(pluginDir, 'migrations.json')
                  );

                  // If the plugin has any of these files, create sub-items
                  const subItems: any[] = [];

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

                  if (subItems.length > 0) {
                    pluginItems.push({
                      label: packageName,
                      items: subItems,
                    });
                  } else {
                    // If no sub-items, link directly to the plugin overview
                    pluginItems.push({
                      label: packageName,
                      link: `/api/plugins/${dir}`,
                    });
                  }
                }
              } catch (e) {
                throw new Error(
                  `Failed to parse package.json for ${dir}: ${e}`
                );
              }
            }
          }

          // Sort plugin items alphabetically
          pluginItems.sort((a, b) => a.label.localeCompare(b.label));

          logger.info(`Found ${pluginItems.length} plugins`);

          // Find the API Reference section in the sidebar
          const sidebar = config.sidebar || [];
          const apiRefIndex = sidebar.findIndex(
            (item) =>
              typeof item === 'object' &&
              'label' in item &&
              item.label === 'API Reference'
          );

          if (apiRefIndex !== -1) {
            const apiRefSection = sidebar[apiRefIndex] as any;

            // Find the Plugins section within API Reference
            if (apiRefSection.items) {
              const pluginsIndex = apiRefSection.items.findIndex(
                (item: any) => item.label === 'Plugins'
              );

              if (pluginsIndex !== -1) {
                // Replace the existing plugins section with the dynamic one
                apiRefSection.items[pluginsIndex] = {
                  label: 'Plugins',
                  items: [
                    { label: 'Overview', slug: 'api/plugins' },
                    ...pluginItems,
                  ],
                };

                // Update the config with the modified sidebar
                updateConfig({ sidebar });
                console.log(JSON.stringify(sidebar, null, 2));
                logger.info(
                  'Successfully updated sidebar with dynamic plugin list'
                );
              }
            }
          }
        } catch (error) {
          logger.error(`Error generating plugin sidebar: ${error}`);
        }
      },
    },
  };
}
