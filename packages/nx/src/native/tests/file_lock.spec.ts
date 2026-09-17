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

  it('keeps the lock when `tryLock` succeeds, unlike `check`', () => {
    const holder = new FileLock(lockPath);

    expect(holder.tryLock()).toBe(true);
    try {
      // `check` releases what it took, so this is the difference that lets a
      // caller acquire without blocking its thread in `lock`.
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

    // Raced against a timer rather than a resolved promise. `waitUntilFree`
    // is a Rust async task, so it settles on a macrotask and an already
    // resolved promise would win this race whether it waited or not.
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
      // Rejected rather than returned, so a caller cannot read past a timeout
      // the way one read past a falsy result and then read a cache nobody wrote.
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

      // The blocking `lock()` would have frozen these timers for the whole wait,
      // which is what makes this worth asserting rather than assuming.
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

    // Free afterwards: a wait that held what it waited for would deadlock the
    // next acquire in the same process.
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
