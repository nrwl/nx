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
      if (err === 'reconnecting') {
        // Silent - daemon restarts automatically on lockfile changes
        return;
      } else if (err === 'reconnected') {
        // Silent - reconnection succeeded
        return;
      } else if (err === 'closed') {
        logger.error(`Failed to reconnect to daemon after multiple attempts`);
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
