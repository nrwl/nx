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

  it('waits after a failed `tryLock` until the holder releases', async () => {
    const observer = new FileLock(lockPath);
    const holder = new FileLock(lockPath);
    holder.lock();

    expect(observer.tryLock()).toBe(false);
    const waiting = observer.wait().then(() => 'free');

    // A timer, not a resolved promise: the native wait settles on a macrotask,
    // so a microtask would win whether or not it waited.
    const sentinel = new Promise((resolve) =>
      setTimeout(() => resolve('sentinel'), 50)
    );
    expect(await Promise.race([waiting, sentinel])).toBe('sentinel');

    holder.unlock();
    expect(await waiting).toBe('free');
    expect(observer.tryLock()).toBe(true);
    observer.unlock();
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

  it('answers `true` to `check` on the holder without releasing the lock', () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      expect(holder.check()).toBe(true);
      expect(new FileLock(lockPath).locked).toBe(true);
    } finally {
      holder.unlock();
    }
  });

  it('gives up on a held lock once the timeout passes', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();
    const observer = new FileLock(lockPath);

    try {
      expect(observer.lockTimeout(50)).toBe(false);
      expect(await observer.waitTimeout(50)).toBe(false);
    } finally {
      holder.unlock();
    }

    expect(observer.lockTimeout(50)).toBe(true);
    observer.unlock();
  });

  it('waits without a deadline for `waitTimeout(Infinity)`', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();
    const waiting = new FileLock(lockPath).waitTimeout(Infinity);

    // A timer, not a resolved promise, as in the `wait` test above.
    const sentinel = new Promise((resolve) =>
      setTimeout(() => resolve('sentinel'), 50)
    );
    expect(await Promise.race([waiting, sentinel])).toBe('sentinel');

    holder.unlock();
    expect(await waiting).toBe(true);
  });

  it('refuses a timeout that is not a count of milliseconds', () => {
    const lock = new FileLock(lockPath);

    expect(() => lock.lockTimeout(-1)).toThrow(/non-negative number/);
    expect(() => lock.lockTimeout(NaN)).toThrow(/non-negative number/);
    expect(() => lock.waitTimeout(-1)).toThrow(/non-negative number/);
    expect(lock.locked).toBe(false);
  });
});
