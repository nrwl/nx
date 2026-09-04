const mockCommit = vi.fn();
vi.mock('../migrate-commits', () => ({
  commitMigrationIfRequested: (...args: unknown[]) => mockCommit(...args),
}));

const mockReadPackageJsonDeps = vi.fn();
const mockRunInstall = vi.fn();
const mockLogSkippedInstall = vi.fn();
vi.mock('../execute-migration', () => ({
  readPackageJsonDeps: (...args: unknown[]) => mockReadPackageJsonDeps(...args),
  runInstall: (...args: unknown[]) => mockRunInstall(...args),
  logSkippedPostMigrationInstall: (...args: unknown[]) =>
    mockLogSkippedInstall(...args),
}));

vi.mock('../../../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerCommand: () => ({ exec: 'npx', install: 'npm install' }),
}));

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as pc from 'picocolors';
import { FileLock } from '../../../native';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import type { MigrateOutputSink } from '../deferred-output';
import {
  BrokerStaleRequestError,
  BrokerUnavailableError,
  brokerDir,
  commitStepTree,
  MigrateCommitBroker,
  type BrokerResult,
} from './broker';
import {
  readRunState,
  runDir,
  writeRunState,
  type MigrateRunState,
  type MigrateStep,
} from './run-state';

const runId = 'run-1';
const committed = {
  status: 'committed' as const,
  sha: 'face0001face0001face0001face0001face0001',
};

function step(overrides: Partial<MigrateStep> = {}): MigrateStep {
  return {
    id: 'step-1',
    roundIndex: 0,
    migrationId: '@nx/js:gen',
    status: 'running',
    attempt: 1,
    dispenseCount: 1,
    pid: process.pid,
    depsHashAtDispense: 'baseline',
    ...overrides,
  };
}

function runState(overrides: Partial<MigrateRunState> = {}): MigrateRunState {
  return {
    formatVersion: 1,
    runId,
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [step()],
    commits: [],
    analytics: { startEmitted: false, completeEmitted: false },
    ...overrides,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('migrate commit broker', () => {
  const originalEnv = { ...process.env };
  let root: string;
  let dir: string;
  let stdout: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-migrate-broker-'));
    dir = runDir(root, runId);
    mkdirSync(dir, { recursive: true });
    writeRunState(dir, runState());
    stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    }) as typeof process.stdout.write);
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(output, 'error').mockImplementation(() => {});
    mockCommit.mockReset().mockResolvedValue(committed);
    mockReadPackageJsonDeps.mockReset().mockReturnValue('{"deps":2}');
    mockRunInstall.mockReset().mockResolvedValue(undefined);
    mockLogSkippedInstall.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    rmSync(root, { recursive: true, force: true });
  });

  function brokerFiles(): string[] {
    return existsSync(brokerDir(dir)) ? readdirSync(brokerDir(dir)).sort() : [];
  }

  function publishResult(nonce: string, result: BrokerResult): void {
    mkdirSync(brokerDir(dir), { recursive: true });
    writeFileSync(
      join(brokerDir(dir), `${nonce}-step-1-1.result.json`),
      JSON.stringify(result)
    );
  }

  // Answers like a parent whose install ran and whose commit landed, writing
  // through the sinks it was handed.
  function parentCommits(): void {
    mockRunInstall.mockImplementation(
      async (_root, _phase, _rerun, sink: MigrateOutputSink) => {
        sink.raw('added 1 package\n');
      }
    );
    mockCommit.mockImplementation(
      async (
        _root,
        _migration,
        _create,
        _prefix,
        installDeps: () => Promise<void>,
        _pending,
        _guidance,
        out: MigrateOutputSink
      ) => {
        await installDeps();
        out.line('dim', '- Committed @nx/js:gen.');
        return committed;
      }
    );
  }

  describe('commitStepTree', () => {
    it('runs in process when no session advertised a broker', async () => {
      delete process.env.NX_MIGRATE_BROKER;
      const inProcess = vi.fn().mockResolvedValue(committed);

      const commit = await commitStepTree(
        dir,
        step(),
        false,
        ['step-0'],
        inProcess
      );

      expect(commit).toEqual({
        result: committed,
        absorbedStepIds: ['step-0'],
      });
      expect(inProcess).toHaveBeenCalledTimes(1);
      expect(existsSync(brokerDir(dir))).toBe(false);
    });

    it('hands the request to the advertised session and lands what it answers', async () => {
      writeRunState(
        dir,
        runState({
          steps: [
            step({ id: 'step-0', migrationId: '@nx/js:old', status: 'failed' }),
            step(),
          ],
          commits: [{ kind: 'failed', stepIds: ['step-0'] }],
        })
      );
      parentCommits();
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;
      const inProcess = vi.fn();

      // The caller's own absorbed ids are replaced by the parent's.
      const pending = commitStepTree(dir, step(), true, [], inProcess);
      await sleep(20);
      await broker.service();
      const commit = await pending;
      broker.close();

      expect(commit).toEqual({
        result: committed,
        absorbedStepIds: ['step-0'],
      });
      expect(inProcess).not.toHaveBeenCalled();
      expect(mockCommit).toHaveBeenCalledWith(
        root,
        { name: 'gen' },
        true,
        'chore: [nx migration] ',
        expect.any(Function),
        [{ package: '@nx/js', name: 'old' }],
        undefined,
        expect.anything()
      );
      // The request carried the caller's effective skip-install value, so
      // the parent skipped the install it would otherwise have run.
      expect(mockRunInstall).not.toHaveBeenCalled();
      expect(mockLogSkippedInstall).toHaveBeenCalledWith(
        root,
        expect.anything()
      );
      // The parent's output, printed here.
      expect(logger.info).toHaveBeenCalledWith(
        pc.dim('- Committed @nx/js:gen.')
      );
      expect(brokerFiles()).toEqual([]);
    });

    it('prints the install output the session collected before landing the commit', async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = commitStepTree(dir, step(), false, [], vi.fn());
      await sleep(20);
      await broker.service();
      await pending;
      const request = JSON.parse(
        readFileSync(
          join(brokerDir(dir), `${broker.nonce}-step-1-1.request.json`),
          'utf8'
        )
      );
      broker.close();

      expect(request).toEqual({
        stepId: 'step-1',
        attempt: 1,
        skipInstall: false,
      });
      expect(mockRunInstall).toHaveBeenCalledWith(
        root,
        'post-migration',
        'npx nx migrate',
        expect.anything()
      );
      expect(stdout).toBe('added 1 package\n');
    });

    it('fails the step with the install error the session reported, after printing what the install said', async () => {
      mockRunInstall.mockImplementation(
        async (_root, _phase, _rerun, sink: MigrateOutputSink) => {
          sink.raw('npm error E404\n');
          throw new Error('registry unreachable');
        }
      );
      mockCommit.mockImplementation(async (...args: unknown[]) => {
        await (args[4] as () => Promise<void>)();
      });
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = commitStepTree(dir, step(), false, [], vi.fn());
      await sleep(20);
      await broker.service();
      await expect(pending).rejects.toThrow('registry unreachable');
      broker.close();

      expect(stdout).toBe('npm error E404\n');
      expect(readRunState(dir).steps[0].installFailed).toBe(true);
    });

    it('keeps waiting when the lock probe cannot be built', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      mkdirSync(join(brokerDir(dir), 'deadbeef.lock'), { recursive: true });
      let settled = false;

      const pending = commitStepTree(dir, step(), false, [], vi.fn()).finally(
        () => {
          settled = true;
        }
      );
      await sleep(600);
      const settledWithoutProbe = settled;
      publishResult('deadbeef', {
        kind: 'commit',
        result: committed,
        absorbedStepIds: [],
        output: [],
      });
      await pending;

      expect(settledWithoutProbe).toBe(false);
    });

    it('throws the stale error when the session no longer owns the attempt', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = commitStepTree(
        dir,
        step({ attempt: 2 }),
        false,
        [],
        vi.fn()
      );
      await sleep(20);
      await broker.service();
      await expect(pending).rejects.toBeInstanceOf(BrokerStaleRequestError);
      broker.close();

      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('keeps waiting while the session holds its lock', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;
      let settled = false;

      const pending = commitStepTree(dir, step(), false, [], vi.fn()).finally(
        () => {
          settled = true;
        }
      );
      await sleep(700);
      const settledWhileLocked = settled;
      await broker.service();
      await pending;
      broker.close();

      expect(settledWhileLocked).toBe(false);
    });

    it('gives up once the lock is free without an answer', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';

      await expect(
        commitStepTree(dir, step(), false, [], vi.fn())
      ).rejects.toBeInstanceOf(BrokerUnavailableError);
    });

    it('takes a published answer over a free lock', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      publishResult('deadbeef', {
        kind: 'commit',
        result: committed,
        absorbedStepIds: [],
        output: [],
      });

      expect(await commitStepTree(dir, step(), false, [], vi.fn())).toEqual({
        result: committed,
        absorbedStepIds: [],
      });
    });

    it('keeps waiting when the lock cannot be probed', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      vi.spyOn(FileLock.prototype, 'check').mockImplementation(() => {
        throw new Error('EBADF');
      });
      let settled = false;

      const pending = commitStepTree(dir, step(), false, [], vi.fn()).finally(
        () => {
          settled = true;
        }
      );
      await sleep(600);
      const settledWithoutProbe = settled;
      publishResult('deadbeef', {
        kind: 'commit',
        result: committed,
        absorbedStepIds: [],
        output: [],
      });
      await pending;

      expect(settledWithoutProbe).toBe(false);
    });
  });

  describe('MigrateCommitBroker', () => {
    function writeRequest(
      nonce: string,
      request = { stepId: 'step-1', attempt: 1, skipInstall: true }
    ): string {
      mkdirSync(brokerDir(dir), { recursive: true });
      writeFileSync(
        join(brokerDir(dir), `${nonce}-step-1-1.request.json`),
        JSON.stringify(request)
      );
      return join(brokerDir(dir), `${nonce}-step-1-1.result.json`);
    }

    it('holds the session lock from construction until close, then removes its files', () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const lockPath = join(brokerDir(dir), `${broker.nonce}.lock`);
      writeRequest(broker.nonce);
      writeRequest('00000000');

      const probe = new FileLock(lockPath);
      const heldDuringSession = probe.check();
      broker.close();

      expect(broker.nonce).toMatch(/^[0-9a-f]{8}$/);
      expect(heldDuringSession).toBe(true);
      expect(probe.check()).toBe(false);
      expect(brokerFiles()).toEqual(['00000000-step-1-1.request.json']);
    });

    it('answers a request once, whatever else rewrites it', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const resultPath = writeRequest(broker.nonce);

      await broker.service();
      await broker.service();
      rmSync(resultPath);
      writeRequest(broker.nonce);
      await broker.service();
      broker.close();

      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(existsSync(resultPath)).toBe(false);
    });

    it.each<[string, Partial<MigrateRunState>]>([
      ['the attempt moved on', { steps: [step({ attempt: 2 })] }],
      ['the step is settled', { steps: [step({ status: 'succeeded' })] }],
      ['the step is unknown', { steps: [step({ id: 'step-9' })] }],
      ['the run does not commit', { createCommits: false }],
    ])(
      'answers stale without installing or committing when %s',
      async (_case, overrides) => {
        writeRunState(dir, runState(overrides));
        const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
        const resultPath = writeRequest(broker.nonce, {
          stepId: 'step-1',
          attempt: 1,
          skipInstall: false,
        });

        await broker.service();
        const result = JSON.parse(readFileSync(resultPath, 'utf8'));
        broker.close();

        expect(result).toEqual({ kind: 'stale' });
        expect(mockCommit).not.toHaveBeenCalled();
        expect(mockRunInstall).not.toHaveBeenCalled();
      }
    );

    it('does not mark an install failure on an attempt that replaced the one it ran for', async () => {
      mockRunInstall.mockImplementation(async () => {
        // A concurrent reconcile rearmed the step while the install ran.
        writeRunState(
          dir,
          runState({ steps: [step({ status: 'pending', attempt: 2 })] })
        );
        throw new Error('registry unreachable');
      });
      mockCommit.mockImplementation(async (...args: unknown[]) => {
        await (args[4] as () => Promise<void>)();
      });
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const resultPath = writeRequest(broker.nonce, {
        stepId: 'step-1',
        attempt: 1,
        skipInstall: false,
      });

      await broker.service();
      const result = JSON.parse(readFileSync(resultPath, 'utf8'));
      broker.close();

      expect(result.kind).toBe('install-failed');
      expect(readRunState(dir).steps[0].installFailed).toBeUndefined();
    });

    it("leaves another session's requests alone", async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const foreign = writeRequest('00000000');

      await broker.service();
      broker.close();

      expect(mockCommit).not.toHaveBeenCalled();
      expect(existsSync(foreign)).toBe(false);
      expect(brokerFiles()).toEqual(['00000000-step-1-1.request.json']);
    });

    it('fails when the answer cannot be published', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const resultPath = writeRequest(broker.nonce);
      mkdirSync(resultPath);
      writeFileSync(join(resultPath, 'occupied'), '');

      await expect(broker.service()).rejects.toThrow();
      broker.close();

      expect(mockCommit).toHaveBeenCalledTimes(1);
    });
  });
});
