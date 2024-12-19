import { existsSync, rmSync, watch, writeFileSync } from 'fs';

export class FileLock {
  locked: boolean;

  private lockFilePath: string;
  lockPromise: Promise<void>;

  constructor(file: string) {
    this.lockFilePath = `${file}.lock`;
    this.locked = existsSync(this.lockFilePath);
  }

  lock() {
    if (this.locked) {
      throw new Error(`File ${this.lockFilePath} is already locked`);
    }
    this.locked = true;
    writeFileSync(this.lockFilePath, '');
  }

  unlock() {
    if (!this.locked) {
      throw new Error(`File ${this.lockFilePath} is not locked`);
    }
    this.locked = false;
    try {
      rmSync(this.lockFilePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  wait(timeout?: number) {
    return new Promise<void>((res, rej) => {
      try {
        // If the file watcher is supported, we can use it to wait for the lock file to be deleted.
        let watcher = watch(this.lockFilePath);
        watcher.on('change', (eventType) => {
          // For whatever reason, the node file watcher can sometimes
          // emit rename events instead of delete events.
          if (eventType === 'delete' || eventType === 'rename') {
            this.locked = false;
            watcher.close();
            res();
          }
        });
      } catch {
        // File watching is not supported
        let start = Date.now();
        let interval = setInterval(() => {
          if (!this.locked || !existsSync(this.lockFilePath)) {
            clearInterval(interval);
            res();
          }

          const elapsed = Date.now() - start;
          if (timeout && elapsed > timeout) {
            rej(
              new Error(`Timeout waiting for file lock ${this.lockFilePath}`)
            );
          }
        }, 2);
      }
    });
  }
}
