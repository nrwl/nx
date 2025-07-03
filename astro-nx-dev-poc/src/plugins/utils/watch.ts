import type { FSWatcher } from 'vite';
import { existsSync } from 'fs';

export function watchAndCall(
  watcher: FSWatcher,
  filesToWatch: string[],
  callback: () => void
) {
  if (!watcher) {
    throw new Error('Watcher is not defined');
  }

  filesToWatch.forEach((file) => {
    if (existsSync(file)) {
      watcher.add(file);
    } else {
      console.warn(`File to watch does not exist: ${file}`);
    }
  });
  watcher.on('change', (filePath) => {
    if (filesToWatch.some((file) => filePath.includes(file))) {
      callback();
    }
  });
}
