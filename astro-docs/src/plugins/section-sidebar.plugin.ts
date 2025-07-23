import type { StarlightPlugin } from '@astrojs/starlight/types';
import { autoPluginSidebarPlugin } from './auto-plugin-sidebar.plugin.ts';

export function sectionSidebarPlugin(): StarlightPlugin {
  return {
    name: 'section-sidebar',
    hooks: {
      setup(params) {
        const { logger, updateConfig } = params;
        logger.info('Setting up section-based sidebar...');
        // Then apply the auto-plugin sidebar to modify the API section with dynamic plugins
        const autoPlugin = autoPluginSidebarPlugin();
        if (autoPlugin.hooks?.setup) {
          autoPlugin.hooks.setup(params);
        }

        logger.info('Section-based sidebar configured');
      },
    },
  };
}
