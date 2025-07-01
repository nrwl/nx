import type { StarlightPlugin } from '@astrojs/starlight/types';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { workspaceRoot } from '@nx/devkit';

function getStaticPluginFiles(
  pluginDir: string,
  workspaceRoot: string
): Array<{ label: string; slug: string }> {
  const staticFiles: Array<{ label: string; slug: string }> = [];
  const pluginContentDir = join(
    workspaceRoot,
    'astro-nx-dev-poc',
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
    // Ignore errors when reading static files
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

        const pluginItems: Array<{
          label: string;
          link?: string;
          items?: any[];
          collapsed?: boolean;
        }> = [];

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

            const item = generatePluginSideBarConfig(
              packagesDir,
              dir,
              packageName
            );
            pluginItems.push(item);
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
              item.label === 'References'
          );

          if (apiRefIndex !== -1) {
            const apiRefSection = sidebar[apiRefIndex] as any;

            if (apiRefSection.items) {
              apiRefSection.items.push(...pluginItems);

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
) {
  const pluginDir = join(packagesDir, dir);

  // Check for generators.json, executors.json, and migrations.json
  const hasGenerators = existsSync(join(pluginDir, 'generators.json'));
  const hasExecutors = existsSync(join(pluginDir, 'executors.json'));
  const hasMigrations = existsSync(join(pluginDir, 'migrations.json'));

  // Create sub-items for generated docs and static files
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
