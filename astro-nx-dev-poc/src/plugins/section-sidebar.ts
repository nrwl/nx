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

        // Apply the auto-plugin sidebar for API section, calling here since we want these plugins tied to each other
        const autoPlugin = autoPluginSidebar();
        if (autoPlugin.hooks?.setup) {
          autoPlugin.hooks.setup(params);
        }

        // Set the initial sidebar to all sections combined
        // (Starlight will handle filtering based on current page)
        const allSidebars = getAllSidebarItems();
        updateConfig({ sidebar: allSidebars });

        logger.info('Section-based sidebar configured');
      },
    },
  };
}
