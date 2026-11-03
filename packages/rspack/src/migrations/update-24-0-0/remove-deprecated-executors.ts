import { logger, type Tree } from '@nx/devkit';
import { migrateRemovedExecutors } from '@nx/devkit/internal';
import { convertConfigToRspackPluginGenerator } from '../../generators/convert-config-to-rspack-plugin/convert-config-to-rspack-plugin';
import { inventoryComposePlugins } from './inventory';

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    [
      '@nx/rspack:rspack',
      '@nx/rspack:dev-server',
      '@nrwl/rspack:rspack',
      '@nrwl/rspack:dev-server',
    ],
    async (tree, options) => {
      await convertHelperConfigs(tree);
      const { convertToInferred } =
        require('../../generators/convert-to-inferred/convert-to-inferred') as typeof import('../../generators/convert-to-inferred/convert-to-inferred');
      return convertToInferred(tree, options);
    }
  );
}

// convert-to-inferred skips configs built on the removed helpers, so convert
// those first. migrate-compose-plugins reports the `.old` configs left behind.
async function convertHelperConfigs(tree: Tree) {
  for (const usage of inventoryComposePlugins(tree)) {
    if (!usage.usesExecutor || !usage.usesHelpers) continue;
    // Left for the Module Federation migration, like migrate-compose-plugins.
    if (usage.usesModuleFederation) continue;
    try {
      await convertConfigToRspackPluginGenerator(tree, {
        project: usage.name,
        skipFormat: true,
      });
    } catch (e) {
      logger.warn(
        `Could not convert the rspack config helpers in ${usage.name}: ${(e as Error).message}`
      );
    }
  }
}
