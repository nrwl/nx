import type { StarlightPlugin } from '@astrojs/starlight/types';
import { autoPluginSidebar } from './auto-plugin-sidebar';
import { getAllSidebarItems } from '../config/sidebar.config';

export function sectionSidebar(): StarlightPlugin {
  return {
    name: 'section-sidebar',
    hooks: {
      setup(params) {
        const { logger, updateConfig } = params;
        logger.info('Setting up section-based sidebar...');

        // Set the initial sidebar to all sections combined first
        // (Starlight will handle filtering based on current page)
        const allSidebars = getAllSidebarItems();
        updateConfig({ sidebar: allSidebars });

        // Then apply the auto-plugin sidebar to modify the API section with dynamic plugins
        const autoPlugin = autoPluginSidebar();
        if (autoPlugin.hooks?.setup) {
          autoPlugin.hooks.setup(params);
        }

        logger.info('Section-based sidebar configured');
      },
    },
  };
}
