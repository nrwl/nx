import type { StarlightPlugin } from '@astrojs/starlight/types';
import { autoPluginSidebar } from './auto-plugin-sidebar';

// Define sidebar configurations for each section
const sidebarConfigs = {
  'getting-started': [
    {
      label: 'Getting Started',
      autogenerate: { directory: 'getting-started' },
    },
  ],
  'api': [
    {
      label: 'API Reference',
      items: [
        { label: 'Nx CLI', slug: 'api/nx-cli' },
        { label: 'Nx Cloud CLI', slug: 'api/nx-cloud-cli' },
        {
          label: 'Plugins',
          items: [
            { label: 'Overview', slug: 'api/plugins' },
            // Plugins will be dynamically added by the autoPluginSidebar plugin
          ],
        },
      ],
    },
  ],
  // Easy to add new sections here
  // 'guides': [
  //   {
  //     label: 'Guides',
  //     autogenerate: { directory: 'guides' },
  //   },
  // ],
};

export function sectionSidebar(): StarlightPlugin {
  return {
    name: 'section-sidebar',
    hooks: {
      setup({ config, logger, updateConfig, addIntegration }) {
        logger.info('Setting up section-based sidebar...');
        
        // Apply the auto-plugin sidebar for API section
        const autoPlugin = autoPluginSidebar();
        if (autoPlugin.hooks?.setup) {
          autoPlugin.hooks.setup({ config, logger, updateConfig, addIntegration });
        }
        
        // Set the initial sidebar to all sections combined
        // (Starlight will handle filtering based on current page)
        const allSidebars = Object.values(sidebarConfigs).flat();
        updateConfig({ sidebar: allSidebars });
        
        logger.info('Section-based sidebar configured');
      },
    },
  };
}