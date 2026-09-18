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

  it('resolves `waitUntilFree` once the holder releases', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    const waiting = new FileLock(lockPath).waitUntilFree().then(() => 'free');

    // A timer, not a resolved promise: the native wait settles on a macrotask,
    // so a microtask would win whether or not it waited.
    const sentinel = new Promise((resolve) =>
      setTimeout(() => resolve('sentinel'), 50)
    );
    expect(await Promise.race([waiting, sentinel])).toBe('sentinel');

    holder.unlock();
    expect(await waiting).toBe('free');
  });

  it('leaves the JS thread free while `waitUntilFree` is pending', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    let ticks = 0;
    const ticking = setInterval(() => ticks++, 10);
    const waiting = new FileLock(lockPath).waitUntilFree();
    await new Promise((resolve) => setTimeout(resolve, 150));
    clearInterval(ticking);
    holder.unlock();
    await waiting;

    expect(ticks).toBeGreaterThan(0);
  });

  it('does not take the lock it waited for, so the caller still has to acquire it', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();
    holder.unlock();

    const observer = new FileLock(lockPath);
    await expect(observer.waitUntilFree()).resolves.toBeUndefined();

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
