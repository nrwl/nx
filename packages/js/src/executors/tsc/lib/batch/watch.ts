import { logger } from '@nx/devkit';
import { daemonClient } from 'nx/src/daemon/client/client';
import { join } from 'path';
import type { TaskInfo } from './types';

export async function watchTaskProjectsPackageJsonFileChanges(
  taskInfos: TaskInfo[],
  callback: (changedTaskInfos: TaskInfo[]) => void
): Promise<() => void> {
  const projects: string[] = [];
  const packageJsonTaskInfoMap = new Map<string, TaskInfo>();
  taskInfos.forEach((t) => {
    projects.push(t.context.projectName);
    packageJsonTaskInfoMap.set(join(t.options.projectRoot, 'package.json'), t);
  });

  const unregisterFileWatcher = await daemonClient.registerFileWatcher(
    { watchProjects: projects },
    (err, data) => {
      if (err === 'closed') {
        logger.error(`Watch error: Daemon closed the connection`);
        process.exit(1);
      } else if (err) {
        logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
      } else {
        const changedTasks = [];
        data.changedFiles.forEach((file) => {
          if (packageJsonTaskInfoMap.has(file.path)) {
            changedTasks.push(packageJsonTaskInfoMap.get(file.path));
          }
        });

        if (changedTasks.length) {
          callback(changedTasks);
        }
      }
    }
  );

  return () => unregisterFileWatcher();
}

export async function watchTaskProjectsFileChangesForAssets(
  taskInfos: TaskInfo[]
): Promise<() => void> {
  const unregisterFileWatcher = await daemonClient.registerFileWatcher(
    {
      watchProjects: taskInfos.map((t) => t.context.projectName),
      includeDependentProjects: true,
      includeGlobalWorkspaceFiles: true,
    },
    (err, data) => {
      if (err === 'closed') {
        logger.error(`Watch error: Daemon closed the connection`);
        process.exit(1);
      } else if (err) {
        logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
      } else {
        taskInfos.forEach((t) =>
          t.assetsHandler.processWatchEvents(data.changedFiles)
        );
      }
    }
  );

  return () => unregisterFileWatcher();
}
