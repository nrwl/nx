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
  installStepTree,
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

  // Finds the pending request rather than naming it: the id carries the seam.
  async function pendingRequestName(nonce: string): Promise<string> {
    for (let i = 0; i < 200; i++) {
      const name = brokerFiles().find(
        (f) =>
          f.startsWith(`${nonce}-`) &&
          f.endsWith('.request.json') &&
          !existsSync(
            join(brokerDir(dir), f.replace('.request.json', '.result.json'))
          )
      );
      if (name) return name;
      await sleep(10);
    }
    throw new Error('No request was published');
  }

  async function readRequest(nonce: string): Promise<object> {
    return JSON.parse(
      readFileSync(
        join(brokerDir(dir), await pendingRequestName(nonce)),
        'utf8'
      )
    );
  }

  async function answerRequest(
    nonce: string,
    result: BrokerResult
  ): Promise<void> {
    const name = await pendingRequestName(nonce);
    writeFileSync(
      join(brokerDir(dir), name.replace('.request.json', '.result.json')),
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
      const request = await readRequest(broker.nonce);
      await broker.service();
      await pending;
      broker.close();

      expect(request).toEqual({
        kind: 'commit',
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
      await answerRequest('deadbeef', {
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
      // The parent answered and then died before the next poll: the poll
      // finds both the result and a free lock.
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      mkdirSync(brokerDir(dir), { recursive: true });
      const parentLock = new FileLock(join(brokerDir(dir), 'deadbeef.lock'));
      parentLock.lock();

      const pending = commitStepTree(dir, step(), false, [], vi.fn());
      await answerRequest('deadbeef', {
        kind: 'commit',
        result: committed,
        absorbedStepIds: [],
        output: [],
      });
      parentLock.unlock();

      expect(await pending).toEqual({ result: committed, absorbedStepIds: [] });
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
      await answerRequest('deadbeef', {
        kind: 'commit',
        result: committed,
        absorbedStepIds: [],
        output: [],
      });
      await pending;

      expect(settledWithoutProbe).toBe(false);
    });
  });

  describe('installStepTree', () => {
    it('runs in process when no session advertised a broker', async () => {
      delete process.env.NX_MIGRATE_BROKER;
      const inProcess = vi.fn().mockResolvedValue(undefined);

      await installStepTree(dir, step(), false, 'install', inProcess);

      expect(inProcess).toHaveBeenCalledTimes(1);
      expect(existsSync(brokerDir(dir))).toBe(false);
    });

    it('hands the install to the advertised session, which moves the baseline it recorded', async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;
      const inProcess = vi.fn();

      const pending = installStepTree(dir, step(), false, 'install', inProcess);
      const request = await readRequest(broker.nonce);
      await broker.service();
      await pending;
      broker.close();

      expect(request).toEqual({
        kind: 'install',
        stepId: 'step-1',
        attempt: 1,
        skipInstall: false,
      });
      expect(inProcess).not.toHaveBeenCalled();
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRunInstall).toHaveBeenCalledWith(
        root,
        'post-migration',
        'npx nx migrate',
        expect.anything()
      );
      expect(stdout).toBe('added 1 package\n');
      expect(readRunState(dir).steps[0].depsHashAtDispense).not.toBe(
        'baseline'
      );
      expect(brokerFiles()).toEqual([]);
    });

    it('fails the step with the install error the session reported', async () => {
      mockRunInstall.mockImplementation(
        async (_root, _phase, _rerun, sink: MigrateOutputSink) => {
          sink.raw('npm error E404\n');
          throw new Error('registry unreachable');
        }
      );
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = installStepTree(dir, step(), false, 'install', vi.fn());
      await sleep(20);
      await broker.service();
      await expect(pending).rejects.toThrow('registry unreachable');
      broker.close();

      expect(stdout).toBe('npm error E404\n');
      expect(readRunState(dir).steps[0].installFailed).toBe(true);
    });

    it('throws the stale error when the session no longer owns the attempt', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = installStepTree(
        dir,
        step({ attempt: 2 }),
        false,
        'install',
        vi.fn()
      );
      await sleep(20);
      await broker.service();
      await expect(pending).rejects.toBeInstanceOf(BrokerStaleRequestError);
      broker.close();

      expect(mockRunInstall).not.toHaveBeenCalled();
    });

    it("answers an attempt's install and its later commit as two requests", async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const install = installStepTree(dir, step(), false, 'install', vi.fn());
      await sleep(20);
      await broker.service();
      await install;
      const commit = commitStepTree(dir, step(), false, [], vi.fn());
      await sleep(20);
      await broker.service();
      const landed = await commit;
      broker.close();

      expect(landed).toEqual({ result: committed, absorbedStepIds: [] });
      expect(mockCommit).toHaveBeenCalledTimes(1);
      // The first install moved the baseline, so the commit's own found
      // nothing to install.
      expect(mockRunInstall).toHaveBeenCalledTimes(1);
    });

    it('installs again at the fold when the dependencies changed after the worker installed', async () => {
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const worker = installStepTree(dir, step(), false, 'install', vi.fn());
      await sleep(20);
      await broker.service();
      await worker;
      writeRunState(
        dir,
        runState({
          steps: [step({ status: 'awaiting-prompt-outcome' })],
        })
      );
      mockReadPackageJsonDeps.mockReturnValue('{"deps":3}');
      const fold = installStepTree(
        dir,
        step({ status: 'awaiting-prompt-outcome' }),
        false,
        'fold-install',
        vi.fn()
      );
      await sleep(20);
      await broker.service();
      await fold;
      broker.close();

      expect(mockRunInstall).toHaveBeenCalledTimes(2);
    });

    it('answers a repeated operation of one attempt with its first answer', async () => {
      // A worker that died after asking, then adopted: one commit, both
      // callers see it.
      parentCommits();
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const first = commitStepTree(dir, step(), false, [], vi.fn());
      await sleep(20);
      await broker.service();
      const landed = await first;
      writeRunState(dir, runState({ steps: [step({ status: 'died' })] }));
      const adopted = await commitStepTree(
        dir,
        step({ status: 'died' }),
        false,
        [],
        vi.fn()
      );
      broker.close();

      expect(landed).toEqual({ result: committed, absorbedStepIds: [] });
      expect(adopted).toEqual(landed);
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('MigrateCommitBroker', () => {
    function writeRequest(
      nonce: string,
      request: object = {
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
        skipInstall: true,
      }
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
      ['the step failed', { steps: [step({ status: 'failed' })] }],
      ['the step is unknown', { steps: [step({ id: 'step-9' })] }],
      ['the run does not commit', { createCommits: false }],
    ])(
      'answers stale without installing or committing when %s',
      async (_case, overrides) => {
        writeRunState(dir, runState(overrides));
        const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
        const resultPath = writeRequest(broker.nonce, {
          kind: 'commit',
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

    it('installs for a skipped failed step on a run that does not commit', async () => {
      writeRunState(
        dir,
        runState({ createCommits: false, steps: [step({ status: 'failed' })] })
      );
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
      const resultPath = writeRequest(broker.nonce, {
        kind: 'action-install',
        stepId: 'step-1',
        attempt: 1,
        skipInstall: false,
      });

      await broker.service();
      const installed = JSON.parse(readFileSync(resultPath, 'utf8'));
      broker.close();

      expect(installed).toEqual({ kind: 'installed', output: [] });
      expect(mockRunInstall).toHaveBeenCalledTimes(1);
      expect(mockCommit).not.toHaveBeenCalled();
    });

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
        kind: 'commit',
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

    it.each<[string, object, Partial<MigrateRunState>]>([
      ['unknown', { kind: 'bogus' }, { steps: [step({ status: 'failed' })] }],
      [
        'inherited-name',
        { kind: 'toString' },
        { steps: [step({ status: 'failed' })] },
      ],
      [
        'a worker install for a parked step',
        { kind: 'install' },
        { steps: [step({ status: 'awaiting-prompt-outcome' })] },
      ],
      [
        'a fold install for a running step',
        { kind: 'fold-install' },
        { steps: [step()] },
      ],
      [
        'an action install for a running step',
        { kind: 'action-install' },
        { steps: [step()] },
      ],
    ])(
      'answers stale to a request of %s kind without installing or committing',
      async (_case, request, overrides) => {
        writeRunState(dir, runState({ createCommits: false, ...overrides }));
        const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate');
        const resultPath = writeRequest(broker.nonce, {
          stepId: 'step-1',
          attempt: 1,
          skipInstall: false,
          ...request,
        });

        await broker.service();
        const result = JSON.parse(readFileSync(resultPath, 'utf8'));
        broker.close();

        expect(result).toEqual({ kind: 'stale' });
        expect(mockRunInstall).not.toHaveBeenCalled();
        expect(mockCommit).not.toHaveBeenCalled();
      }
    );

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
