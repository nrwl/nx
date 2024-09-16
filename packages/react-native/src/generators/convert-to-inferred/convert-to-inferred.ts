import { createProjectGraphAsync, formatFiles, type Tree } from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  migrateProjectExecutorsToPluginV1,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodes } from '../../../plugins/plugin';
import { postTargetTransformer } from './lib/post-target-transformer';
import { processStartOptions } from './lib/process-start-options';
import { createProcessOptions } from './lib/create-process-options';

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
    '@nx/react-native/plugin',
    createNodes,
    {
      buildAndroidTargetName: 'build-android',
      buildIosTargetName: 'build-ios',
      bundleTargetName: 'bundle',
      podInstallTargetName: 'pod-install',
      runAndroidTargetName: 'run-android',
      runIosTargetName: 'run-ios',
      startTargetName: 'start',
      syncDepsTargetName: 'sync-deps',
      upgradeTargetName: 'upgrade',
    },
    [
      {
        executors: ['@nx/react-native:build-android'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          createProcessOptions(
            '@nx/react-native:build-android',
            ['port', 'resetCache'],
            []
          )
        ),
        targetPluginOptionMapper: (targetName) => ({
          buildAndroidTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:build-ios'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          createProcessOptions(
            '@nx/react-native:build-ios',
            ['port', 'resetCache'],
            ['buildFolder']
          )
        ),
        targetPluginOptionMapper: (targetName) => ({
          buildIosTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:run-android'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          createProcessOptions(
            '@nx/react-native:run-android',
            ['port', 'resetCache'],
            ['appId', 'appIdSuffix', 'deviceId']
          )
        ),
        targetPluginOptionMapper: (targetName) => ({
          runAndroidTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:pod-install'],
        postTargetTransformer: postTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          podInstallTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:run-ios'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          createProcessOptions(
            '@nx/react-native:run-ios',
            ['port', 'resetCache'],
            ['buildFolder']
          )
        ),
        targetPluginOptionMapper: (targetName) => ({
          runIosTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:start'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processStartOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          startTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:sync-deps'],
        postTargetTransformer: postTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          startTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/react-native:upgrade'],
        postTargetTransformer: postTargetTransformer(migrationLogs),
        targetPluginOptionMapper: (targetName) => ({
          upgradeTargetName: targetName,
        }),
      },
    ],
    options.project
  );

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
