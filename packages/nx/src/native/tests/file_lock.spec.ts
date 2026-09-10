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
    expect(observer.check()).toBe(true);
    const waiting = observer.wait().then(() => 'wait');

    // Raced against an already-settled promise rather than timed: `wait` goes
    // through the napi thread pool either way, so "not settled yet" is true of a
    // free file too and would hold with no holder at all.
    expect(await Promise.race([waiting, Promise.resolve('sentinel')])).toBe(
      'sentinel'
    );

    holder.unlock();
    expect(await waiting).toBe('wait');
  });

  it('settles `wait` without a holder, which is what makes the race above mean something', async () => {
    const observer = new FileLock(lockPath);
    expect(observer.check()).toBe(false);

    expect(await observer.wait()).toBeUndefined();
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

  it('resolves `waitForRelease` true once the holder releases', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    const waiting = new FileLock(lockPath)
      .waitForRelease(10_000)
      .then((released) => `released:${released}`);

    // Raced rather than timed, so the assertion cannot pass on a wait that
    // settled at once.
    expect(await Promise.race([waiting, Promise.resolve('sentinel')])).toBe(
      'sentinel'
    );

    holder.unlock();
    expect(await waiting).toBe('released:true');
  });

  it('gives up on `waitForRelease` rather than waiting on a holder forever', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      const started = Date.now();
      expect(await new FileLock(lockPath).waitForRelease(200)).toBe(false);
      expect(Date.now() - started).toBeGreaterThanOrEqual(190);
    } finally {
      holder.unlock();
    }
  });

  it('leaves the JS thread free while `waitForRelease` is pending', async () => {
    const holder = new FileLock(lockPath);
    holder.lock();

    try {
      let ticks = 0;
      const ticking = setInterval(() => ticks++, 10);
      await new FileLock(lockPath).waitForRelease(150);
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
    expect(await observer.waitForRelease(200)).toBe(true);

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
