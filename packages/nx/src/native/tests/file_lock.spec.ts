import { join } from 'path';

import { TempFs } from '../../internal-testing-utils/temp-fs';
import { FileLock } from '../index';
import { isLockWaitTimeout } from '../../utils/file-lock';

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

  it('keeps the lock when `tryLock` succeeds, unlike `check`', () => {
    const holder = new FileLock(lockPath);

    expect(holder.tryLock()).toBe(true);
    try {
      expect(new FileLock(lockPath).check()).toBe(true);
    } finally {
      holder.unlock();
    }
  });

  it('resolves `waitUntilFree` once the holder releases', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    const waiting = new FileLock(lockPath)
      .waitUntilFree(10_000)
      .then(() => 'free');

    // A timer, not a resolved promise: the native wait settles on a macrotask,
    // so a microtask would win whether or not it waited.
    const sentinel = new Promise((resolve) =>
      setTimeout(() => resolve('sentinel'), 50)
    );
    expect(await Promise.race([waiting, sentinel])).toBe('sentinel');

    holder.unlock();
    expect(await waiting).toBe('free');
  });

  it('rejects `waitUntilFree` rather than waiting on a holder forever', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      const started = Date.now();
      await expect(new FileLock(lockPath).waitUntilFree(200)).rejects.toSatisfy(
        isLockWaitTimeout
      );
      expect(Date.now() - started).toBeGreaterThanOrEqual(190);
    } finally {
      holder.unlock();
    }
  });

  it('leaves the JS thread free while `waitUntilFree` is pending', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      let ticks = 0;
      const ticking = setInterval(() => ticks++, 10);
      await new FileLock(lockPath).waitUntilFree(150).catch(() => {});
      clearInterval(ticking);

      expect(ticks).toBeGreaterThan(0);
    } finally {
      holder.unlock();
    }
  });

  it('does not take the lock it waited for, so the caller still has to acquire it', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();
    holder.unlock();

    const observer = new FileLock(lockPath);
    await expect(observer.waitUntilFree(200)).resolves.toBeUndefined();

    expect(new FileLock(lockPath).tryLock()).toBe(true);
  });

  it('reports failure from `tryLock` rather than blocking', () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      expect(new FileLock(lockPath).tryLock()).toBe(false);
    } finally {
      holder.unlock();
    }

    expect(new FileLock(lockPath).tryLock()).toBe(true);
  });

  it('leaves the lock free after `check`, so checking is not taking', () => {
    const first = new FileLock(lockPath);
    expect(first.check()).toBe(false);

    const second = new FileLock(lockPath);
    expect(second.locked).toBe(false);
  });
});
