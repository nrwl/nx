import { watch } from 'chokidar';

export function createFileWatcher(
  dir: string,
  root: string,
  callback: () => void
) {
  const watcher = watch(dir, { cwd: root, ignoreInitial: true });

  watcher.on('all', () => {
    callback();
  });

  return { close: () => watcher.close() };
}
