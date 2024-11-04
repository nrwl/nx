import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  type Tree,
} from '@nx/devkit';
import { AggregatedLog } from '@nx/devkit/src/generators/plugin-migrations/aggregate-log-util';
import {
  migrateProjectExecutorsToPluginV1,
  NoTargetsToMigrateError,
} from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import { createNodes } from '../../../plugins/plugin';
import { processBuildOptions } from './lib/process-build-options';
import { postTargetTransformer } from './lib/post-target-transformer';
import { processExportOptions } from './lib/process-export-options';
import { processRunOptions } from './lib/process-run-options';
import { processServeOptions } from './lib/process-serve-options';
import { processStartOptions } from './lib/process-start-options';
import { processSubmitOptions } from './lib/process-submit-options';
import { processPrebuildOptions } from './lib/process-prebuild-options';
import { processInstallOptions } from './lib/process-install-options';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migrationLogs = new AggregatedLog();
  const projects = getProjects(tree);
  const migratedProjects = await migrateProjectExecutorsToPluginV1(
    tree,
    projectGraph,
    '@nx/expo/plugin',
    createNodes,
    {
      buildTargetName: 'build',
      exportTargetName: 'export',
      installTargetName: 'install',
      prebuildTargetName: 'prebuild',
      runAndroidTargetName: 'run-android',
      runIosTargetName: 'run-ios',
      serveTargetName: 'serve',
      startTargetName: 'start',
      submitTargetName: 'submit',
    },
    [
      {
        executors: ['@nx/expo:build'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processBuildOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          buildTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:export'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processExportOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          exportTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:install'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processInstallOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          installTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:prebuild'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processPrebuildOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          prebuildTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:run'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processRunOptions
        ),
        targetPluginOptionMapper: (targetName) => {
          // Assumption: There are no targets with the same name but different platforms.
          // Most users will likely keep the `run-ios` and `run-android` target names that are generated.
          // Otherwise, we look for the first target with a matching name, and use that platform.
          const platform = getPlatformForFirstMatchedTarget(
            targetName,
            '@nx/expo:run',
            projects
          );
          return {
            [platform === 'android'
              ? 'runAndroidTargetName'
              : 'runIosTargetName']: targetName,
          };
        },
      },
      {
        executors: ['@nx/expo:serve'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processServeOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          serveTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:start'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processStartOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          startTargetName: targetName,
        }),
      },
      {
        executors: ['@nx/expo:submit'],
        postTargetTransformer: postTargetTransformer(
          migrationLogs,
          processSubmitOptions
        ),
        targetPluginOptionMapper: (targetName) => ({
          submitTargetName: targetName,
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

function getPlatformForFirstMatchedTarget(
  targetName: string,
  executorName: string,
  projects: Map<string, any>
): string {
  for (const [, project] of projects) {
    const target = project.targets[targetName];
    if (target && target.executor === executorName && target.options.platform) {
      return target.options.platform;
    }
  }
  // Default is ios in executor, although we do always generate it in project.json.
  return 'ios';
}

export default convertToInferred;
