import { logger } from '@nx/devkit';
import { daemonClient } from 'nx/src/daemon/client/client';
import { join } from 'path';

export async function watchForSingleFileChanges(
  projectName: string,
  projectRoot: string,
  relativeFilePath: string,
  callback: () => void
): Promise<() => void> {
  const unregisterFileWatcher = await daemonClient.registerFileWatcher(
    { watchProjects: [projectName] },
    (err, data) => {
      if (err === 'closed') {
        logger.error(`Watch error: Daemon closed the connection`);
        process.exit(1);
      } else if (err) {
        logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
      } else if (
        data.changedFiles.some(
          (file) => file.path == join(projectRoot, relativeFilePath)
        )
      ) {
        callback();
      }
    }
  );

  return () => unregisterFileWatcher();
}
