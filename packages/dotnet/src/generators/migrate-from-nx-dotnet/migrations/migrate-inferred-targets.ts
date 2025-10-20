import { logger } from '@nx/devkit';
import { MigrationContext, MigrationStep } from './types';

/**
 * Migration: Migrate inferredTargets from RC config to plugin options
 */
export function migrateInferredTargets(
  context: MigrationContext
): MigrationStep {
  const { rcConfig, dotnetPlugin } = context;
  const completed: string[] = [];
  const manualSteps: string[] = [];

  if (!rcConfig.inferredTargets) {
    return { completed, manualSteps };
  }

  logger.info('  Migrating inferredTargets configuration...');
  if (!dotnetPlugin.options) {
    dotnetPlugin.options = {};
  }

  for (const [targetType, targetConfig] of Object.entries(
    rcConfig.inferredTargets
  )) {
    if (targetConfig === false) {
      // Target is disabled
      dotnetPlugin.options[targetType] = false;
      logger.info(`    - Disabled ${targetType} target`);
    } else if (typeof targetConfig === 'string') {
      // Simple rename
      dotnetPlugin.options[targetType] = { targetName: targetConfig };
      logger.info(`    - Renamed ${targetType} target to "${targetConfig}"`);
    } else if (typeof targetConfig === 'object') {
      // Complex configuration
      dotnetPlugin.options[targetType] = targetConfig;
      logger.info(
        `    - Migrated ${targetType} target with custom configuration`
      );
    }
  }

  completed.push(
    'Migrated `inferredTargets` configuration to @nx/dotnet plugin options in nx.json'
  );

  return { completed, manualSteps };
}
