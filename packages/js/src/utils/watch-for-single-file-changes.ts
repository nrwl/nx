import { logger } from '@nrwl/devkit';
import { join } from 'path';

export async function watchForSingleFileChanges(
  watchDir: string,
  relativeFilePath: string,
  callback: () => void
) {
  const watcher = await import('@parcel/watcher');
  const subscription = await watcher.subscribe(watchDir, (err, events) => {
    const file = join(watchDir, relativeFilePath);
    if (err) {
      logger.error(`Watch error: ${err?.message ?? 'Unknown'}`);
    } else {
      for (const event of events) {
        if (event.path === file) {
          callback();
          break;
        }
      }
    }
  });

  return () => subscription.unsubscribe();
}
