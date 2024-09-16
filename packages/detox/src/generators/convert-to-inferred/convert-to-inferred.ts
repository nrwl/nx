import {
  createProjectGraphAsync,
  formatFiles,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  updateNxJson,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  migrateProjectExecutorsToPluginV1,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodes } from '../../plugins/plugin';
import { processBuildOptions } from './lib/process-build-options';
import { postTargetTransformer } from './lib/post-target-transformer';
import { processTestOptions } from './lib/process-test-options';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationLogs = new AggregatedLog();
  const migratedProjects = await migrateProjectExecutorsToPluginV1(
    tree,
    projectGraph,
    '@nx/detox/plugin',
    createNodes,
    {
      buildTargetName: 'build',
      startTargetName: 'start',
      testTargetName: 'test',
    },
    [
      {
        executors: ['@nx/detox:build'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processBuildOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          buildTargetName: targetName, // We should use "build" instead of "build-ios" or "build-android". We'll handle this later.
        }),
      },
      {
        executors: ['@nx/detox:test'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processTestOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          testTargetName: targetName, // We should use "test" instead of "test-ios" or "test-android". We'll handle this later.
        }),
      },
    ],
    options.project
  );

  const nxJson = readNxJson(tree);
  const detoxPlugins = nxJson.plugins?.filter(
    (p) => typeof p !== 'string' && p.plugin === '@nx/detox/plugin'
  );

  // These were either `build-ios`, `test-ios`, etc., and we need to set them back to their generic names.
  // The per-project targets will call these with additional `--args` passed to maintain the same
  // behavior as previous executor-based targets.
  for (const p of detoxPlugins) {
    if (typeof p === 'string') continue;
    p.options['buildTargetName'] = 'build';
    p.options['testTargetName'] = 'test';
  }

  // Inform the users that the inferred targets are platform-agnostic, and they can remove the old targets if unnecessary.
  for (const [project] of migratedProjects) {
    migrationLogs.addLog({
      project,
      executorName: '@nx/detox:build',
      log: `The "build-android" target was migrated to use "nx run ${project}:build", which is platform-agnostic. If you no longer need this target, you can remove it.`,
    });
    migrationLogs.addLog({
      project,
      executorName: '@nx/detox:test',
      log: `The "test-android" target was migrated to use "nx run ${project}:test", which is platform-agnostic. If you no longer need this target, you can remove it.`,
    });
    migrationLogs.addLog({
      project,
      executorName: '@nx/detox:build',
      log: `The "build-ios" target was migrated to use "nx run ${project}:build", which is platform-agnostic. If you no longer need this target, you can remove it.`,
    });
    migrationLogs.addLog({
      project,
      executorName: '@nx/detox:test',
      log: `The "test-ios" target was migrated to use "nx run ${project}:test", which is platform-agnostic. If you no longer need this target, you can remove it.`,
    });
  }

  updateNxJson(tree, nxJson);

  if (migratedProjects.size === 0) {
    throw new NoTargetsToMigrateError();
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    migrationLogs.flushLogs();
  };
}

export default convertToInferred;
