import { logger } from '@nx/devkit';
import { MigrationContext, MigrationStep } from './types';

/**
 * Migration: Migrate executor-based targetDefaults to plugin options
 */
export function migrateTargetDefaults(
  context: MigrationContext
): MigrationStep {
  const { nxJson, dotnetPlugin } = context;
  const completed: string[] = [];
  const manualSteps: string[] = [];
  const migratedExecutors: string[] = [];

  if (!nxJson.targetDefaults) {
    return { completed, manualSteps };
  }

  // Map of old executor names to target types
  const executorToTargetType: Record<string, string> = {
    '@nx-dotnet/core:build': 'build',
    '@nx-dotnet/core:test': 'test',
    '@nx-dotnet/core:serve': 'serve',
    '@nx-dotnet/core:publish': 'publish',
  };

  for (const [executorName, config] of Object.entries(nxJson.targetDefaults)) {
    const targetType = executorToTargetType[executorName];
    if (targetType) {
      logger.info(
        `  Migrating targetDefaults for ${executorName} to plugin options...`
      );

      if (!dotnetPlugin.options) {
        dotnetPlugin.options = {};
      }

      // Don't override if already configured from inferredTargets
      if (!dotnetPlugin.options[targetType]) {
        dotnetPlugin.options[targetType] = config;
        logger.info(
          `    - Migrated ${executorName} configuration to ${targetType} target`
        );
      } else {
        // Merge configurations
        dotnetPlugin.options[targetType] = {
          ...dotnetPlugin.options[targetType],
          ...(config as any),
        };
        logger.info(
          `    - Merged ${executorName} configuration with existing ${targetType} target`
        );
      }

      // Remove the old executor-based targetDefault
      delete nxJson.targetDefaults[executorName];
      migratedExecutors.push(executorName);
    }
  }

  if (migratedExecutors.length > 0) {
    logger.info('  ✓ Migrated executor-based targetDefaults');
    completed.push(
      `Migrated executor-based targetDefaults (${migratedExecutors.join(
        ', '
      )}) to @nx/dotnet plugin options`
    );
  }

  return { completed, manualSteps };
}
