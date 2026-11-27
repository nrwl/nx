// Stub the shutdown path so a restart decision can be observed without taking
// it. vi.hoisted runs before the hoisted vi.mock factories, which is the only
// way the spy can be shared with them.
const { terminate, restart } = vi.hoisted(() => ({
  terminate: vi.fn(),
  restart: vi.fn(),
}));
vi.mock('./shutdown-utils', () => ({
  handleServerProcessTermination: terminate,
  handleServerProcessTerminationWithRestart: restart,
}));
vi.mock('../logger', () => ({
  serverLogger: { log: vi.fn(), watcherLog: vi.fn() },
}));
vi.mock('../is-nx-version-mismatch', () => ({
  isNxVersionMismatch: vi.fn(() => false),
}));
vi.mock('../cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cache')>()),
  getDaemonProcessIdSync: vi.fn(() => process.pid),
}));
// The real hasher, spied on: the specs below are about when the lockfiles are
// read, not what their hash is.
vi.mock('../../native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../native')>();
  return { ...actual, hashFile: vi.fn(actual.hashFile) };
});

import { TempFs } from '../../internal-testing-utils/temp-fs';
import { EventType, hashFile, type ChangeBatch } from '../../native';
import { getDaemonProcessIdSync } from '../cache';
import { isNxVersionMismatch } from '../is-nx-version-mismatch';
import {
  changedPaths,
  recordLockFileHash,
  registerDaemonForRestartChecks,
  restartDaemonIfIgnoreFilesChanged,
  restartDaemonIfLockFilesChanged,
  stopDaemonIfOutdated,
  stopDaemonIfReplaced,
} from './restart-checks';

describe('restartDaemonIfIgnoreFilesChanged', () => {
  beforeEach(() => {
    terminate.mockClear();
    registerDaemonForRestartChecks({} as import('net').Server, []);
  });

  it.each(['.gitignore', '.nxignore'])(
    'restarts the daemon when %s changes',
    (name) => {
      expect(restartDaemonIfIgnoreFilesChanged([`pkg/${name}`])).toBe(true);
      expect(terminate).toHaveBeenCalledTimes(1);
    }
  );

  // .ignore is a ripgrep convention neither create_walker nor the watch
  // filterer reads, so editing one changes no rule and must not cost a restart.
  it('leaves the daemon running when a .ignore changes', () => {
    expect(restartDaemonIfIgnoreFilesChanged(['pkg/.ignore'])).toBe(false);
    expect(terminate).not.toHaveBeenCalled();
  });
});

describe('lockfile checks', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('restart-checks');
    fs.createFilesSync({ 'yarn.lock': 'one' });
    registerDaemonForRestartChecks({} as import('net').Server, []);
    recordLockFileHash();
    vi.mocked(hashFile).mockClear();
    vi.mocked(getDaemonProcessIdSync).mockClear();
    terminate.mockClear();
    restart.mockClear();
  });

  afterEach(() => {
    fs.cleanup();
  });

  describe('restartDaemonIfLockFilesChanged', () => {
    it.each([
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      'bun.lock',
    ])('restarts the daemon when %s at the root changes', (name) => {
      expect(restartDaemonIfLockFilesChanged([name])).toBe(true);
      expect(restart).toHaveBeenCalledTimes(1);
      expect(restart.mock.calls[0][0].reason).toBe('LOCK_FILES_CHANGED');
      expect(terminate).not.toHaveBeenCalled();
    });

    it('restarts the daemon when a lockfile at the root is deleted', () => {
      const batch: ChangeBatch = {
        seq: 1,
        createdFiles: [],
        updatedFiles: [],
        deletedFiles: ['yarn.lock'],
      };

      expect(restartDaemonIfLockFilesChanged(changedPaths(batch))).toBe(true);
      expect(restart).toHaveBeenCalledTimes(1);
    });

    // The workspace context hashed the write and dropped it if the bytes were
    // unchanged, so the batch is trusted and no lockfile is read here.
    it('reads no lockfile', () => {
      expect(restartDaemonIfLockFilesChanged(['yarn.lock'])).toBe(true);
      expect(hashFile).not.toHaveBeenCalled();
    });

    it('leaves the daemon running when the changed paths do not name one', () => {
      expect(
        restartDaemonIfLockFilesChanged(['pkg/src/index.ts', 'pkg/yarn.lock'])
      ).toBe(false);
      expect(hashFile).not.toHaveBeenCalled();
      expect(restart).not.toHaveBeenCalled();
    });
  });

  describe('stopDaemonIfOutdated', () => {
    it('leaves the daemon running when nothing changed', () => {
      expect(stopDaemonIfOutdated()).toBe(false);
      expect(terminate).not.toHaveBeenCalled();
      expect(restart).not.toHaveBeenCalled();
    });

    it('restarts the daemon when a lockfile changed unreported', () => {
      fs.createFileSync('yarn.lock', 'two');

      expect(stopDaemonIfOutdated()).toBe(true);
      expect(restart).toHaveBeenCalledTimes(1);
      expect(restart.mock.calls[0][0].reason).toBe('LOCK_FILES_CHANGED');
    });

    it('stops the daemon when another process owns the process file', () => {
      vi.mocked(getDaemonProcessIdSync).mockReturnValueOnce(process.pid + 1);

      expect(stopDaemonIfOutdated()).toBe(true);
      expect(terminate).toHaveBeenCalledTimes(1);
      expect(terminate.mock.calls[0][0].reason).toBe(
        'this process is no longer the current daemon (native)'
      );
      expect(hashFile).not.toHaveBeenCalled();
    });

    it('stops the daemon when the installed nx is not the one running', () => {
      vi.mocked(isNxVersionMismatch).mockReturnValueOnce(true);

      expect(stopDaemonIfOutdated()).toBe(true);
      expect(terminate).toHaveBeenCalledTimes(1);
      expect(terminate.mock.calls[0][0].reason).toBe('NX_VERSION_CHANGED');
      expect(restart).not.toHaveBeenCalled();
    });
  });

  describe('stopDaemonIfReplaced', () => {
    it('checks the process file when the watch dropped events', () => {
      vi.mocked(getDaemonProcessIdSync).mockReturnValueOnce(process.pid + 1);

      expect(stopDaemonIfReplaced([{ path: '', type: EventType.rescan }])).toBe(
        true
      );
      expect(terminate).toHaveBeenCalledTimes(1);
    });

    it('keeps running after a rescan while it owns the process file', () => {
      expect(stopDaemonIfReplaced([{ path: '', type: EventType.rescan }])).toBe(
        false
      );
      expect(terminate).not.toHaveBeenCalled();
    });

    it('does not read the process file for other events', () => {
      vi.mocked(getDaemonProcessIdSync).mockReturnValueOnce(process.pid + 1);

      expect(
        stopDaemonIfReplaced([
          { path: 'pkg/src/index.ts', type: EventType.update },
        ])
      ).toBe(false);
      expect(getDaemonProcessIdSync).not.toHaveBeenCalled();
      expect(terminate).not.toHaveBeenCalled();
    });
  });
});
