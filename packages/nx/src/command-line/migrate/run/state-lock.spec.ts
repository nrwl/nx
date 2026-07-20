import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileLock } from '../../../native';
import {
  CURRENT_RUN_STATE_FORMAT_VERSION,
  NewerRunStateFormatError,
  migrateRunsDir,
  readRunState,
  writeRunState,
  type MigrateRunState,
} from './run-state';
import {
  updateRunState,
  withRunCreationLock,
  withRunStateLock,
} from './state-lock';

const LOCK_FILE = 'run.json.lock';

function buildState(overrides: Partial<MigrateRunState> = {}): MigrateRunState {
  return {
    formatVersion: CURRENT_RUN_STATE_FORMAT_VERSION,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    mode: 'orchestrated',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [],
    issues: [],
    commits: [],
    analytics: { startEmitted: false, completeEmitted: false },
    ...overrides,
  };
}

describe('state-lock', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nx-migrate-lock-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // flock is per open file description, so a probe from a second fd conflicts
  // with a lock held by this same process and reports it as locked.
  function isLocked(lockPath: string = join(dir, LOCK_FILE)): boolean {
    return new FileLock(lockPath).locked;
  }

  describe('withRunStateLock', () => {
    it('holds the native lock while fn runs and releases it afterwards', () => {
      let lockedDuringFn = false;

      withRunStateLock(dir, () => {
        lockedDuringFn = isLocked();
      });

      expect(lockedDuringFn).toBe(true);
      expect(isLocked()).toBe(false);
    });

    it('releases the lock even when fn throws', () => {
      expect(() =>
        withRunStateLock(dir, () => {
          throw new Error('boom');
        })
      ).toThrow('boom');

      expect(isLocked()).toBe(false);
    });
  });

  describe('withRunCreationLock', () => {
    // The creation lock lives in .nx/migrate-runs itself: unlike the state
    // lock it must exist before any run directory does.
    function creationLockPath(root: string): string {
      return join(migrateRunsDir(root), 'init.lock');
    }

    it('creates the runs directory and holds the lock while fn runs', () => {
      let lockedDuringFn = false;
      let runsDirDuringFn = false;

      const result = withRunCreationLock(dir, () => {
        lockedDuringFn = isLocked(creationLockPath(dir));
        runsDirDuringFn = existsSync(migrateRunsDir(dir));
        return 42;
      });

      expect(result).toBe(42);
      expect(runsDirDuringFn).toBe(true);
      expect(lockedDuringFn).toBe(true);
      expect(isLocked(creationLockPath(dir))).toBe(false);
    });

    it('releases the lock even when fn throws', () => {
      expect(() =>
        withRunCreationLock(dir, () => {
          throw new Error('boom');
        })
      ).toThrow('boom');

      expect(isLocked(creationLockPath(dir))).toBe(false);
    });
  });

  describe('updateRunState', () => {
    it('applies to the fresh on-disk state, not a stale copy', () => {
      writeRunState(dir, buildState({ commitPrefix: 'ON-DISK' }));

      const applied = updateRunState(dir, (fresh) => {
        // Proves the read happened under the lock, against the current file.
        expect(fresh.commitPrefix).toBe('ON-DISK');
        return { ...fresh, status: 'completed' };
      });

      expect(applied.status).toBe('completed');
      expect(applied.commitPrefix).toBe('ON-DISK');
      expect(readRunState(dir).status).toBe('completed');
    });

    it('skips the write when apply returns null and returns the fresh state', () => {
      writeRunState(dir, buildState());
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      const result = updateRunState(dir, () => null);

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      expect(result).toEqual(readRunState(dir));
    });

    it('propagates a newer-format run state instead of overwriting it', () => {
      writeFileSync(
        join(dir, 'run.json'),
        JSON.stringify(buildState({ formatVersion: 2, nxVersion: '123.4.5' }))
      );

      expect(() => updateRunState(dir, (fresh) => fresh)).toThrow(
        NewerRunStateFormatError
      );
      // The lock is released even though the read threw.
      expect(isLocked()).toBe(false);
    });
  });
});
