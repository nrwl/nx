import { forEachExecutorOptions } from '@nx/devkit/internal';
import {
  readProjectConfiguration,
  type Tree,
  updateProjectConfiguration,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';
import { isAbsolute } from 'path';

interface VitestExecutorOptions {
  reportsDirectory?: string;
}

/**
 * Migrates reportsDirectory option for @nx/vitest:test and @nx/vite:test executors.
 *
 * Previously, reportsDirectory was resolved relative to the project root (cwd).
 * Now it is resolved relative to the workspace root. This migration prepends
 * {projectRoot}/ to existing naked paths so the resolved location stays the same.
 */
export default function prefixReportsDirectoryWithProjectRoot(tree: Tree) {
  migrateProjectConfigurations(tree);
  migrateTargetDefaults(tree);
}

function migrateProjectConfigurations(tree: Tree): void {
  const projectsToUpdate = new Map<
    string,
    Map<string, { target: string; configuration?: string }>
  >();

  for (const executorName of ['@nx/vitest:test', '@nx/vite:test']) {
    forEachExecutorOptions<VitestExecutorOptions>(
      tree,
      executorName,
      (options, projectName, targetName, configuration) => {
        if (needsMigration(options.reportsDirectory)) {
          if (!projectsToUpdate.has(projectName)) {
            projectsToUpdate.set(projectName, new Map());
          }
          const key = configuration
            ? `${targetName}::${configuration}`
            : targetName;
          projectsToUpdate
            .get(projectName)
            .set(key, { target: targetName, configuration });
        }
      }
    );
  }

  for (const [projectName] of projectsToUpdate) {
    const projectConfig = readProjectConfiguration(tree, projectName);

    for (const [_targetName, target] of Object.entries(
      projectConfig.targets || {}
    )) {
      if (
        target.executor !== '@nx/vitest:test' &&
        target.executor !== '@nx/vite:test'
      ) {
        continue;
      }

      if (needsMigration(target.options?.reportsDirectory)) {
        target.options.reportsDirectory = prependProjectRoot(
          target.options.reportsDirectory
        );
      }

      if (target.configurations) {
        for (const config of Object.values(target.configurations)) {
          if (needsMigration(config?.reportsDirectory)) {
            config.reportsDirectory = prependProjectRoot(
              config.reportsDirectory
            );
          }
        }
      }
    }

    updateProjectConfiguration(tree, projectName, projectConfig);
  }
}

function migrateTargetDefaults(tree: Tree): void {
  const nxJson = readNxJson(tree);
  if (!nxJson?.targetDefaults) {
    return;
  }

  let hasChanges = false;

  for (const [_key, targetConfig] of Object.entries(nxJson.targetDefaults)) {
    if (
      targetConfig.executor !== '@nx/vitest:test' &&
      targetConfig.executor !== '@nx/vite:test' &&
      _key !== '@nx/vitest:test' &&
      _key !== '@nx/vite:test'
    ) {
      continue;
    }

    if (needsMigration(targetConfig.options?.reportsDirectory)) {
      targetConfig.options.reportsDirectory = prependProjectRoot(
        targetConfig.options.reportsDirectory
      );
      hasChanges = true;
    }

    if (targetConfig.configurations) {
      for (const config of Object.values(targetConfig.configurations)) {
        if (needsMigration((config as any)?.reportsDirectory)) {
          (config as any).reportsDirectory = prependProjectRoot(
            (config as any).reportsDirectory
          );
          hasChanges = true;
        }
      }
    }
  }

  if (hasChanges) {
    updateNxJson(tree, nxJson);
  }
}

function needsMigration(reportsDirectory: string | undefined): boolean {
  if (!reportsDirectory) {
    return false;
  }
  if (isAbsolute(reportsDirectory)) {
    return false;
  }
  // Already starts with {projectRoot} — already project-root-relative
  if (reportsDirectory.startsWith('{projectRoot}')) {
    return false;
  }
  // Already starts with {workspaceRoot} — user intended workspace-root-relative
  if (reportsDirectory.startsWith('{workspaceRoot}')) {
    return false;
  }
  return true;
}

function prependProjectRoot(reportsDirectory: string): string {
  return `{projectRoot}/${reportsDirectory}`;
}
