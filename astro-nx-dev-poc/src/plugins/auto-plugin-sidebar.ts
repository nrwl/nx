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
        
        // Get all directories in packages
        const packagesDir = join(workspaceRoot, 'packages');
        
        if (!existsSync(packagesDir)) {
          logger.warn('No packages directory found');
          return;
        }
        
        const pluginItems: Array<{ label: string; link: string }> = [];
        
        try {
          const directories = readdirSync(packagesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          // Check each directory for a package.json
          for (const dir of directories) {
            const packageJsonPath = join(packagesDir, dir, 'package.json');
            
            if (existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
                const packageName = packageJson.name || `@nx/${dir}`;
                
                // Only include @nx scoped packages
                if (packageName.startsWith('@nx/')) {
                  pluginItems.push({
                    label: packageName,
                    link: `/api/plugins/${dir}`,
                  });
                }
              } catch (e) {
                logger.warn(`Failed to parse package.json for ${dir}`);
              }
            }
          }
          
          // Sort plugin items alphabetically
          pluginItems.sort((a, b) => a.label.localeCompare(b.label));
          
          logger.info(`Found ${pluginItems.length} plugins`);
          
          // Find the API Reference section in the sidebar
          const sidebar = config.sidebar || [];
          const apiRefIndex = sidebar.findIndex(
            item => typeof item === 'object' && 'label' in item && item.label === 'API Reference'
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
                logger.info('Successfully updated sidebar with dynamic plugin list');
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