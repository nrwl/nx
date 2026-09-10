import { join } from 'path';

import { TempFs } from '../../internal-testing-utils/temp-fs';
import { FileLock } from '../index';

describe('FileLock', () => {
  let tempFs: TempFs;
  let lockPath: string;

  beforeEach(() => {
    tempFs = new TempFs('file-lock');
    lockPath = join(tempFs.tempDir, 'test.lock');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  // The plugin capability cache holds this lock across an await, so a second
  // lock in the same process is not only a cross-process concern.
  it('reports a lock another handle in the same process holds', () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      const observer = new FileLock(lockPath);
      expect(observer.locked).toBe(true);
      expect(observer.check()).toBe(true);
    } finally {
      holder.unlock();
    }
  });

  it('settles `wait` only once the holder releases', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    const observer = new FileLock(lockPath);
    let settled = false;
    const waiting = observer.wait().then(() => {
      settled = true;
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    holder.unlock();
    await waiting;
    expect(settled).toBe(true);
  });

  it('leaves the lock free after `check`, so checking is not taking', () => {
    const first = new FileLock(lockPath);
    expect(first.check()).toBe(false);

    const second = new FileLock(lockPath);
    expect(second.locked).toBe(false);
  });
});
