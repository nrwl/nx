const mockCommit = vi.fn();
vi.mock('../migrate-commits', () => ({
  commitMigrationIfRequested: (...args: unknown[]) => mockCommit(...args),
}));

const mockReadPackageJsonDeps = vi.fn();
const mockRunInstall = vi.fn();
const mockLogSkippedInstall = vi.fn();
vi.mock('../execute-migration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../execute-migration')>()),
  readPackageJsonDeps: (...args: unknown[]) => mockReadPackageJsonDeps(...args),
  runInstall: (...args: unknown[]) => mockRunInstall(...args),
  logSkippedPostMigrationInstall: (...args: unknown[]) =>
    mockLogSkippedInstall(...args),
}));

vi.mock('../../../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerCommand: () => ({ exec: 'npx', install: 'npm install' }),
}));

const mockGetLatestCommitSha = vi.fn();
const mockResetWorkingTree = vi.fn();
vi.mock('../../../utils/git-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/git-utils')>()),
  getLatestCommitSha: (...args: unknown[]) => mockGetLatestCommitSha(...args),
  resetWorkingTree: (...args: unknown[]) => mockResetWorkingTree(...args),
}));

const mockLockCtor = vi.fn();
vi.mock('../../../native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../native')>();
  // A seam before the native constructor runs; the instances stay real.
  function FileLock(path: string) {
    mockLockCtor(path);
    return new actual.FileLock(path);
  }
  FileLock.prototype = actual.FileLock.prototype;
  return { ...actual, FileLock };
});

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as pc from 'picocolors';
import { FileLock } from '../../../native';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import type { MigrateOutputSink } from '../deferred-output';
import { NpmPeerDepsInstallError } from '../execute-migration';
import {
  acquireTreeOperation,
  BrokerStaleRequestError,
  BrokerUnavailableError,
  brokerDir,
  commitStepTree,
  installStepTree,
  MigrateCommitBroker,
  resetStepTree,
  releaseTreeOperation,
  TreeBusyError,
  type BrokerResult,
  type TreeScope,
} from './broker';
import {
  issueFingerprint,
  readRunState,
  runDir,
  writeRunState,
  type MigrateRunPolicy,
  type MigrateRunState,
  type MigrateStep,
  type MigrateTreeOperation,
} from './run-state';
import { serviced } from './test-utils';
import { summarizeError } from './util';

const runId = 'run-1';
const committed = {
  status: 'committed' as const,
  sha: 'face0001face0001face0001face0001face0001',
};
const POLICY: MigrateRunPolicy = { createCommits: true, skipInstall: false };
const ANSWER: BrokerResult = {
  kind: 'commit',
  result: committed,
  absorbedStepIds: [],
  output: [],
};

function step(overrides: Partial<MigrateStep> = {}): MigrateStep {
  return {
    id: 'step-1',
    roundIndex: 0,
    kind: 'migration',
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
    mockLockCtor.mockReset();
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
        ['step-0'],
        inProcess,
        {}
      );

      expect(commit).toEqual({
        result: committed,
        absorbedStepIds: ['step-0'],
        recorded: false,
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
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', {
        ...POLICY,
        skipInstall: true,
      });
      process.env.NX_MIGRATE_BROKER = broker.nonce;
      const inProcess = vi.fn();

      // The caller's own absorbed ids are replaced by the parent's.
      const pending = commitStepTree(dir, step(), [], inProcess, {});
      await sleep(20);
      await broker.service();
      const commit = await pending;
      broker.close();

      expect(commit).toEqual({
        result: committed,
        absorbedStepIds: ['step-0'],
        recorded: true,
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
      expect(mockRunInstall).not.toHaveBeenCalled();
      expect(mockLogSkippedInstall).toHaveBeenCalledWith(
        root,
        expect.anything()
      );
      expect(logger.info).toHaveBeenCalledWith(
        pc.dim('- Committed @nx/js:gen.')
      );
      expect(brokerFiles()).toEqual([
        `${broker.nonce}-step-1-1-commit.result.json`,
      ]);
    });

    it('lands the commit after a succeeded install, keeping the install output out of the step', async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const pending = commitStepTree(dir, step(), [], vi.fn(), {});
      const request = await readRequest(broker.nonce);
      await broker.service();
      await pending;
      broker.close();

      expect(request).toEqual({
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
      });
      expect(mockRunInstall).toHaveBeenCalledWith(
        root,
        'post-migration',
        'npx nx migrate',
        expect.anything()
      );
      expect(stdout).toBe('');
    });

    it.each<
      [string, 'commit' | 'install', Error, string, string | (new () => Error)]
    >([
      [
        'a commit seam',
        'commit',
        new Error('registry unreachable'),
        'npm error E404\n',
        'registry unreachable',
      ],
      [
        'an install seam',
        'install',
        new Error('registry unreachable'),
        'npm error E404\n',
        'registry unreachable',
      ],
      [
        'an install seam whose peers conflict',
        'install',
        new NpmPeerDepsInstallError(),
        'npm error code ERESOLVE\n',
        NpmPeerDepsInstallError,
      ],
    ])(
      'fails the step at %s with the install error the session reported, after printing what the install said',
      async (_case, seam, thrown, raw, expected) => {
        mockRunInstall.mockImplementation(
          async (_root, _phase, _rerun, sink: MigrateOutputSink) => {
            sink.raw(raw);
            throw thrown;
          }
        );
        if (seam === 'commit') {
          mockCommit.mockImplementation(async (...args: unknown[]) => {
            await (args[4] as () => Promise<void>)();
          });
        }
        const broker = new MigrateCommitBroker(
          root,
          dir,
          'npx nx migrate',
          POLICY
        );
        process.env.NX_MIGRATE_BROKER = broker.nonce;

        const pending =
          seam === 'commit'
            ? commitStepTree(dir, step(), [], vi.fn(), {})
            : installStepTree(dir, step(), 'install', vi.fn(), {});
        await sleep(20);
        await broker.service();
        await (typeof expected === 'string'
          ? expect(pending).rejects.toThrow(expected)
          : expect(pending).rejects.toBeInstanceOf(expected));
        broker.close();

        expect(stdout).toBe(raw);
        expect(readRunState(dir).steps[0].installFailed).toBe(true);
      }
    );

    it('refuses the request when the lock probe cannot be built, publishing nothing', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      mkdirSync(join(brokerDir(dir), 'deadbeef.lock'), { recursive: true });

      await expect(
        commitStepTree(dir, step(), [], vi.fn(), {})
      ).rejects.toThrow('is not accepting its request');
      expect(brokerFiles()).toEqual(['deadbeef.lock']);
    });

    it('answers a repeat from a result published while its lock probe failed to build', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      mkdirSync(brokerDir(dir), { recursive: true });
      mockLockCtor.mockImplementation(() => {
        writeFileSync(
          join(brokerDir(dir), 'deadbeef-step-1-1-commit.result.json'),
          JSON.stringify(ANSWER)
        );
        throw new Error('EACCES');
      });

      expect(await commitStepTree(dir, step(), [], vi.fn(), {})).toEqual({
        result: committed,
        absorbedStepIds: [],
        recorded: true,
      });
      expect(brokerFiles()).toEqual(['deadbeef-step-1-1-commit.result.json']);
    });

    it.each<[string, () => Promise<unknown>, typeof mockCommit]>([
      [
        'commit',
        () => commitStepTree(dir, step({ attempt: 2 }), [], vi.fn(), {}),
        mockCommit,
      ],
      [
        'install',
        () =>
          installStepTree(dir, step({ attempt: 2 }), 'install', vi.fn(), {}),
        mockRunInstall,
      ],
    ])(
      'throws the stale error on a %s request when the session no longer owns the attempt',
      async (_seam, call, neverRuns) => {
        const broker = new MigrateCommitBroker(
          root,
          dir,
          'npx nx migrate',
          POLICY
        );
        process.env.NX_MIGRATE_BROKER = broker.nonce;

        const pending = call();
        await sleep(20);
        await broker.service();
        await expect(pending).rejects.toBeInstanceOf(BrokerStaleRequestError);
        broker.close();

        expect(neverRuns).not.toHaveBeenCalled();
      }
    );

    it.each<[string, () => () => Promise<void>]>([
      [
        'the session holds its lock',
        () => {
          const broker = new MigrateCommitBroker(
            root,
            dir,
            'npx nx migrate',
            POLICY
          );
          process.env.NX_MIGRATE_BROKER = broker.nonce;
          return async () => {
            await broker.service();
            broker.close();
          };
        },
      ],
      [
        'the lock cannot be probed',
        () => {
          process.env.NX_MIGRATE_BROKER = 'deadbeef';
          vi.spyOn(FileLock.prototype, 'check').mockImplementation(() => {
            throw new Error('EBADF');
          });
          return () =>
            answerRequest('deadbeef', {
              kind: 'commit',
              result: committed,
              absorbedStepIds: [],
              output: [],
            });
        },
      ],
    ])('keeps waiting while %s', async (_case, arrange) => {
      const answer = arrange();
      let settled = false;

      const pending = commitStepTree(dir, step(), [], vi.fn(), {}).finally(
        () => {
          settled = true;
        }
      );
      await sleep(700);
      const settledWhileWaiting = settled;
      await answer();
      await pending;

      expect(settledWhileWaiting).toBe(false);
    });

    it('gives up once the lock is free without an answer', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';

      const error = await commitStepTree(dir, step(), [], vi.fn(), {}).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(BrokerUnavailableError);
      expect(summarizeError(error)).toBe(
        'The nx migrate session that started this step ended before its request was answered. The install or the commit may still have landed; check the working tree and git log.'
      );
    });

    it('takes an answer published between the poll and the free-lock probe', async () => {
      process.env.NX_MIGRATE_BROKER = 'deadbeef';
      vi.spyOn(FileLock.prototype, 'check').mockImplementation(() => {
        writeFileSync(
          join(brokerDir(dir), 'deadbeef-step-1-1-commit.result.json'),
          JSON.stringify(ANSWER)
        );
        return false;
      });

      expect(await commitStepTree(dir, step(), [], vi.fn(), {})).toEqual({
        result: committed,
        absorbedStepIds: [],
        recorded: true,
      });
    });
  });

  describe('installStepTree', () => {
    it('runs in process when no session advertised a broker', async () => {
      delete process.env.NX_MIGRATE_BROKER;
      const inProcess = vi.fn().mockResolvedValue(undefined);

      await installStepTree(dir, step(), 'install', inProcess, {});

      expect(inProcess).toHaveBeenCalledTimes(1);
      expect(existsSync(brokerDir(dir))).toBe(false);
    });

    it('hands the install to the advertised session, which moves the baseline it recorded', async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      process.env.NX_MIGRATE_BROKER = broker.nonce;
      const inProcess = vi.fn();

      const pending = installStepTree(dir, step(), 'install', inProcess, {});
      const request = await readRequest(broker.nonce);
      await broker.service();
      await pending;
      broker.close();

      expect(request).toEqual({
        kind: 'install',
        stepId: 'step-1',
        attempt: 1,
      });
      expect(inProcess).not.toHaveBeenCalled();
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRunInstall).toHaveBeenCalledWith(
        root,
        'post-migration',
        'npx nx migrate',
        expect.anything()
      );
      expect(stdout).toBe('');
      expect(readRunState(dir).steps[0].depsHashAtDispense).not.toBe(
        'baseline'
      );
      expect(brokerFiles()).toEqual([
        `${broker.nonce}-step-1-1-install.result.json`,
      ]);
    });

    it("answers an attempt's install and its later commit as two requests", async () => {
      parentCommits();
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const install = installStepTree(dir, step(), 'install', vi.fn(), {});
      await sleep(20);
      await broker.service();
      await install;
      const commit = commitStepTree(dir, step(), [], vi.fn(), {});
      await sleep(20);
      await broker.service();
      const landed = await commit;
      broker.close();

      expect(landed).toEqual({
        result: committed,
        absorbedStepIds: [],
        recorded: true,
      });
      expect(mockCommit).toHaveBeenCalledTimes(1);
      // The first install moved the baseline, so the commit's own found
      // nothing to install.
      expect(mockRunInstall).toHaveBeenCalledTimes(1);
    });

    it('answers a repeated operation of one attempt with its first answer', async () => {
      // A worker that died after asking, then adopted: one commit, both
      // callers see it.
      parentCommits();
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      process.env.NX_MIGRATE_BROKER = broker.nonce;

      const first = commitStepTree(dir, step(), [], vi.fn(), {});
      await sleep(20);
      await broker.service();
      const landed = await first;
      const recorded = readRunState(dir);
      writeRunState(dir, {
        ...recorded,
        steps: [{ ...recorded.steps[0], status: 'died' }],
      });
      // The answer alone settles the repeat: it neither republishes the
      // request the session left behind nor probes the session's lock.
      const requestFile = join(
        brokerDir(dir),
        `${broker.nonce}-step-1-1-commit.request.json`
      );
      rmSync(requestFile);
      mockLockCtor.mockClear();
      const adopted = await commitStepTree(
        dir,
        step({ status: 'died' }),
        [],
        vi.fn(),
        {}
      );
      const republished = existsSync(requestFile);
      const locksBuilt = mockLockCtor.mock.calls.length;
      broker.close();

      expect(landed).toEqual({
        result: committed,
        absorbedStepIds: [],
        recorded: true,
      });
      expect(adopted).toEqual(landed);
      expect(republished).toBe(false);
      expect(locksBuilt).toBe(0);
      expect(mockCommit).toHaveBeenCalledTimes(1);
      // Both callers leave the one entry the parent recorded alone.
      expect(readRunState(dir).commits).toEqual([
        { kind: 'landed', sha: committed.sha, stepIds: ['step-1'] },
      ]);
    });
  });

  describe('resetStepTree', () => {
    const ref = 'beef0001beef0001beef0001beef0001beef0001';
    const failed = () =>
      step({
        status: 'failed',
        gitRefBefore: ref,
        treeCleanAtDispense: true,
        generatorCompleted: true,
      });

    beforeEach(() => {
      mockGetLatestCommitSha.mockReset().mockReturnValue(ref);
      mockResetWorkingTree.mockReset();
      writeRunState(dir, runState({ steps: [failed()] }));
    });

    it("hands the reset to the advertised session, which resets to the step's ref and records nothing", async () => {
      const inProcess = vi.fn();

      await serviced(root, dir, POLICY, () =>
        resetStepTree(dir, failed(), inProcess, {})
      );

      expect(inProcess).not.toHaveBeenCalled();
      expect(mockResetWorkingTree).toHaveBeenCalledWith(
        ref,
        ['.nx/migrate-runs'],
        root
      );
      const state = readRunState(dir);
      expect(state.steps[0]).toMatchObject({ status: 'failed', attempt: 1 });
      // The session forgets the generator run the reset discarded.
      expect(state.steps[0].generatorCompleted).toBeUndefined();
      expect(state.commits).toEqual([]);
      expect(state.treeOperation).toBeUndefined();
    });

    it('resets again for a second clean retry of the same attempt', async () => {
      await serviced(root, dir, POLICY, async () => {
        await resetStepTree(dir, failed(), vi.fn(), {});
        await resetStepTree(dir, failed(), vi.fn(), {});
      });

      expect(mockResetWorkingTree).toHaveBeenCalledTimes(2);
      expect(
        brokerFiles().filter((f) => f.includes('-step-1-1-reset-'))
      ).toHaveLength(2);
    });

    it('throws what the session said when the reset failed there, marking nothing', async () => {
      mockResetWorkingTree.mockImplementation(() => {
        throw new Error('fatal: unable to unlink old file');
      });

      await expect(
        serviced(root, dir, POLICY, () =>
          resetStepTree(dir, failed(), vi.fn(), {})
        )
      ).rejects.toThrow('fatal: unable to unlink old file');

      const state = readRunState(dir);
      expect(state.steps[0]).toMatchObject({ status: 'failed', attempt: 1 });
      expect(state.treeOperation).toBeUndefined();
    });

    it('refuses the reset when the state the session reads no longer offers a clean retry', async () => {
      mockGetLatestCommitSha.mockReturnValue(
        'cafe0002cafe0002cafe0002cafe0002cafe0002'
      );

      await expect(
        serviced(root, dir, POLICY, () =>
          resetStepTree(dir, failed(), vi.fn(), {})
        )
      ).rejects.toThrow(
        `HEAD is at cafe0002cafe0002cafe0002cafe0002cafe0002 rather than the ${ref} this migration started from`
      );

      expect(mockResetWorkingTree).not.toHaveBeenCalled();
      expect(readRunState(dir).steps[0].generatorCompleted).toBe(true);
    });

    it('throws the stale error when the session does not commit, whatever run.json says', async () => {
      await expect(
        serviced(root, dir, { ...POLICY, createCommits: false }, () =>
          resetStepTree(dir, failed(), vi.fn(), {})
        )
      ).rejects.toThrow(BrokerStaleRequestError);

      expect(mockResetWorkingTree).not.toHaveBeenCalled();
    });
  });

  it('lands the commit of a failed step adopted by hand after its own commit failed, under the plain name', async () => {
    mockRunInstall.mockRejectedValueOnce(new Error('registry unreachable'));
    mockCommit.mockImplementation(async (...args: unknown[]) => {
      await (args[4] as () => Promise<void>)();
      return committed;
    });
    const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', POLICY);
    process.env.NX_MIGRATE_BROKER = broker.nonce;

    const worker = commitStepTree(dir, step(), [], vi.fn(), {});
    await sleep(20);
    await broker.service();
    await expect(worker).rejects.toThrow('registry unreachable');
    const failed = step({ status: 'failed', generatorCompleted: true });
    writeRunState(dir, runState({ steps: [failed] }));
    const adopted = commitStepTree(dir, failed, [], vi.fn(), {}, 'adopt');
    await sleep(20);
    await broker.service();
    const landed = await adopted;
    broker.close();

    expect(landed).toEqual({
      result: committed,
      absorbedStepIds: [],
      recorded: true,
    });
    expect(mockRunInstall).toHaveBeenCalledTimes(2);
    expect(mockCommit).toHaveBeenCalledTimes(2);
    expect(mockCommit.mock.calls[1][1]).toEqual({ name: 'gen' });
  });

  describe('MigrateCommitBroker', () => {
    function writeRequest(
      nonce: string,
      request: object = {
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
      }
    ): string {
      mkdirSync(brokerDir(dir), { recursive: true });
      writeFileSync(
        join(brokerDir(dir), `${nonce}-step-1-1.request.json`),
        JSON.stringify(request)
      );
      return join(brokerDir(dir), `${nonce}-step-1-1.result.json`);
    }

    it('holds the session lock from construction until close, then removes its requests and lock', () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const lockPath = join(brokerDir(dir), `${broker.nonce}.lock`);
      const answered = writeRequest(broker.nonce);
      writeFileSync(answered, '{}');
      writeRequest('00000000');

      const probe = new FileLock(lockPath);
      const heldDuringSession = probe.check();
      broker.close();

      expect(broker.nonce).toMatch(/^[0-9a-f]{8}$/);
      expect(heldDuringSession).toBe(true);
      expect(probe.check()).toBe(false);
      expect(brokerFiles()).toEqual([
        '00000000-step-1-1.request.json',
        `${broker.nonce}-step-1-1.result.json`,
      ]);
    });

    it.each<[string, () => void]>([
      ['a symlink', () => symlinkSync(root, brokerDir(dir))],
      ['a file', () => writeFileSync(brokerDir(dir), '')],
    ])(
      'refuses to open when %s stands where the broker directory belongs',
      (_what, plant) => {
        plant();

        expect(
          () => new MigrateCommitBroker(root, dir, 'npx nx migrate', POLICY)
        ).toThrow(`something other than a directory at ${brokerDir(dir)}`);
      }
    );

    it('refuses to answer through a symlink swapped in for the broker directory', async () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      writeRequest(broker.nonce);
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere);
      renameSync(brokerDir(dir), join(root, 'moved'));
      symlinkSync(elsewhere, brokerDir(dir));

      await expect(broker.service()).rejects.toThrow(
        `something other than a directory at ${brokerDir(dir)}`
      );
      broker.close();

      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('releases the lock without cleaning through a symlink swapped in for the broker directory', () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const planted = `${broker.nonce}-step-1-1.request.json`;
      const elsewhere = join(root, 'elsewhere');
      mkdirSync(elsewhere);
      writeFileSync(join(elsewhere, planted), '');
      const moved = join(root, 'moved');
      renameSync(brokerDir(dir), moved);
      symlinkSync(elsewhere, brokerDir(dir));
      const probe = new FileLock(join(moved, `${broker.nonce}.lock`));

      broker.close();

      expect(probe.check()).toBe(false);
      expect(readdirSync(elsewhere)).toEqual([planted]);
    });

    it('refuses a request file that is a symlink instead of following it', async () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const elsewhere = join(root, 'planted.json');
      writeFileSync(
        elsewhere,
        JSON.stringify({ kind: 'commit', stepId: 'step-1', attempt: 1 })
      );
      symlinkSync(
        elsewhere,
        join(brokerDir(dir), `${broker.nonce}-step-1-1.request.json`)
      );

      // A valid target proves the symlink is refused, not answered through.
      await expect(broker.service()).rejects.toThrow(/not a regular file/i);
      broker.close();

      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('answers a request once, whatever else rewrites it', async () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
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
      ['the step was given up on', { steps: [step({ status: 'unresolved' })] }],
      ['the step is unknown', { steps: [step({ id: 'step-9' })] }],
    ])(
      'answers stale without installing or committing when %s',
      async (_case, overrides) => {
        writeRunState(dir, runState(overrides));
        const broker = new MigrateCommitBroker(
          root,
          dir,
          'npx nx migrate',
          POLICY
        );
        const resultPath = writeRequest(broker.nonce, {
          kind: 'commit',
          stepId: 'step-1',
          attempt: 1,
        });

        await broker.service();
        const result = JSON.parse(readFileSync(resultPath, 'utf8'));
        broker.close();

        expect(result).toEqual({ kind: 'stale' });
        expect(mockCommit).not.toHaveBeenCalled();
        expect(mockRunInstall).not.toHaveBeenCalled();
      }
    );

    describe('a give-up request', () => {
      const giveUp = { kind: 'give-up', stepId: 'step-1', attempt: 1 };

      it('answers stale when the run makes no commits', async () => {
        writeRunState(dir, runState({ steps: [step({ status: 'failed' })] }));
        const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', {
          ...POLICY,
          createCommits: false,
        });
        const resultPath = writeRequest(broker.nonce, giveUp);

        await broker.service();
        const result = JSON.parse(readFileSync(resultPath, 'utf8'));
        broker.close();

        expect(result).toEqual({ kind: 'stale' });
        expect(mockCommit).not.toHaveBeenCalled();
        expect(readRunState(dir).steps[0].status).toBe('failed');
      });
    });

    it('answers stale to a commit request carrying an unknown marker', async () => {
      // A running step is at the commit seam, so only the marker rejects.
      writeRunState(dir, runState());
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const resultPath = writeRequest(broker.nonce, {
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
        commitAs: 'applied',
      });

      await broker.service();
      const result = JSON.parse(readFileSync(resultPath, 'utf8'));
      broker.close();

      expect(result).toEqual({ kind: 'stale' });
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('answers a commit request stale from the session policy, whatever run.json says', async () => {
      // The run dir is writable from the agent's sandbox, so a createCommits
      // flipped there must not make the parent commit.
      writeRunState(dir, runState({ createCommits: true }));
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', {
        ...POLICY,
        createCommits: false,
      });
      const resultPath = writeRequest(broker.nonce, {
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
      });

      await broker.service();
      const result = JSON.parse(readFileSync(resultPath, 'utf8'));
      broker.close();

      expect(result).toEqual({ kind: 'stale' });
      expect(mockCommit).not.toHaveBeenCalled();
      expect(mockRunInstall).not.toHaveBeenCalled();
    });

    it('skips the install from the session policy, whatever the request or run.json says', async () => {
      writeRunState(dir, runState({ skipInstall: false }));
      const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', {
        ...POLICY,
        skipInstall: true,
      });
      const resultPath = writeRequest(broker.nonce, {
        kind: 'install',
        stepId: 'step-1',
        attempt: 1,
        skipInstall: false,
      });

      await broker.service();
      const result = JSON.parse(readFileSync(resultPath, 'utf8'));
      broker.close();

      expect(result).toEqual({ kind: 'installed', output: [] });
      expect(mockRunInstall).not.toHaveBeenCalled();
      expect(mockLogSkippedInstall).toHaveBeenCalledWith(
        root,
        expect.anything()
      );
    });

    it.each<
      [
        string,
        object,
        Partial<MigrateStep>,
        Partial<MigrateRunState>,
        Partial<MigrateRunPolicy>,
      ]
    >([
      [
        'an action install for a skipped failed step on a run that does not commit',
        { kind: 'action-install' },
        { status: 'failed' },
        { createCommits: false },
        { createCommits: false },
      ],
      [
        'a fold install whose dependencies changed after the worker installed',
        { kind: 'fold-install' },
        {
          status: 'awaiting-prompt-outcome',
          depsHashAtDispense: 'installed-by-worker',
        },
        {},
        {},
      ],
    ])(
      'installs for %s',
      async (
        _case,
        request,
        stepOverrides,
        stateOverrides,
        policyOverrides
      ) => {
        writeRunState(
          dir,
          runState({ ...stateOverrides, steps: [step(stepOverrides)] })
        );
        const broker = new MigrateCommitBroker(root, dir, 'npx nx migrate', {
          ...POLICY,
          ...policyOverrides,
        });
        const resultPath = writeRequest(broker.nonce, {
          stepId: 'step-1',
          attempt: 1,
          ...request,
        });

        await broker.service();
        const installed = JSON.parse(readFileSync(resultPath, 'utf8'));
        broker.close();

        expect(installed).toEqual({ kind: 'installed', output: [] });
        expect(mockRunInstall).toHaveBeenCalledTimes(1);
        expect(mockCommit).not.toHaveBeenCalled();
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
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const resultPath = writeRequest(broker.nonce, {
        kind: 'commit',
        stepId: 'step-1',
        attempt: 1,
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
        const broker = new MigrateCommitBroker(
          root,
          dir,
          'npx nx migrate',
          POLICY
        );
        const resultPath = writeRequest(broker.nonce, {
          stepId: 'step-1',
          attempt: 1,
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
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const foreign = writeRequest('00000000');

      await broker.service();
      broker.close();

      expect(mockCommit).not.toHaveBeenCalled();
      expect(existsSync(foreign)).toBe(false);
      expect(brokerFiles()).toEqual(['00000000-step-1-1.request.json']);
    });

    it('leaves the commit it landed marked as started when its record fails, so a skip cannot hide it', async () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      writeRequest(broker.nonce);
      vi.spyOn(
        MigrateCommitBroker.prototype as unknown as { record: () => void },
        'record'
      ).mockImplementation(() => {
        throw new Error('run.json: ENOSPC');
      });

      await expect(broker.service()).rejects.toThrow('ENOSPC');
      broker.close();

      expect(mockCommit).toHaveBeenCalledTimes(1);
      const state = readRunState(dir);
      expect(state.commits).toEqual([]);
      expect(state.steps[0].commitStarted).toBe(true);
      expect(state.treeOperation).toBeUndefined();
    });

    it('fails when the answer cannot be published, keeping the record of the commit it landed', async () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const resultPath = writeRequest(broker.nonce);
      mkdirSync(resultPath);
      writeFileSync(join(resultPath, 'occupied'), '');

      await expect(broker.service()).rejects.toThrow();
      broker.close();

      expect(mockCommit).toHaveBeenCalledTimes(1);
      // Recorded before the answer: the commit is in history either way.
      const state = readRunState(dir);
      expect(state.commits).toEqual([
        { kind: 'landed', sha: committed.sha, stepIds: ['step-1'] },
      ]);
      expect(state.steps[0].commitLedgerIndex).toBe(0);
    });

    it.each<
      [
        string,
        object,
        MigrateRunState['commits'],
        true | undefined,
        1 | undefined,
      ]
    >([
      [
        'a landed commit with a receipt on the step',
        committed,
        [{ kind: 'landed', sha: committed.sha, stepIds: ['step-1', 'step-0'] }],
        undefined,
        1,
      ],
      [
        'a landed commit whose sha could not be read, with a receipt on the step',
        { status: 'committed', sha: null },
        [{ kind: 'landed', stepIds: ['step-1', 'step-0'] }],
        undefined,
        1,
      ],
      [
        'a failed commit with a receipt on the step',
        { status: 'failed' },
        [{ kind: 'failed', stepIds: ['step-1'] }],
        true,
        1,
      ],
      [
        'nothing for a commit that found no changes',
        { status: 'no-changes' },
        [],
        undefined,
        undefined,
      ],
    ])(
      'records %s before answering',
      async (_case, result, entries, markAfter, ledgerIndex) => {
        writeRunState(
          dir,
          runState({
            steps: [
              step({
                id: 'step-0',
                migrationId: '@nx/js:old',
                status: 'failed',
              }),
              step(),
            ],
            commits: [{ kind: 'failed', stepIds: ['step-0'] }],
          })
        );
        mockCommit.mockResolvedValue(result);
        const broker = new MigrateCommitBroker(
          root,
          dir,
          'npx nx migrate',
          POLICY
        );
        const resultPath = writeRequest(broker.nonce);

        await broker.service();
        broker.close();

        const state = readRunState(dir);
        expect(state.commits).toEqual([
          { kind: 'failed', stepIds: ['step-0'] },
          ...entries,
        ]);
        expect(state.steps[1].commitLedgerIndex).toBe(ledgerIndex);
        expect(state.steps[0].commitLedgerIndex).toBeUndefined();
        // Marked with the reservation; a landed entry accounts for it, while
        // a failure once git ran cannot vouch that nothing landed.
        expect(state.steps[1].commitStarted).toBe(markAfter);
        expect(JSON.parse(readFileSync(resultPath, 'utf8'))).toEqual({
          kind: 'commit',
          result,
          absorbedStepIds: ['step-0'],
          output: [],
        });
      }
    );

    it('records the entry without a receipt when the attempt moved on while it committed', async () => {
      // A reconcile rearmed the step during the commit: the entry still
      // names the step, but the new attempt owes nothing to it.
      mockCommit.mockImplementation(async () => {
        writeRunState(
          dir,
          runState({ steps: [step({ status: 'pending', attempt: 2 })] })
        );
        return committed;
      });
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      writeRequest(broker.nonce);

      await broker.service();
      broker.close();

      const state = readRunState(dir);
      expect(state.commits).toEqual([
        { kind: 'landed', sha: committed.sha, stepIds: ['step-1'] },
      ]);
      expect(state.steps[0].commitLedgerIndex).toBeUndefined();
    });

    it('attaches the resolved issues the entry can carry when it records it', async () => {
      writeRunState(
        dir,
        runState({
          issues: [
            {
              id: 'issue-1',
              fingerprint: issueFingerprint('summary of issue-1'),
              summary: 'summary of issue-1',
              reportedByStepId: 'step-1',
              applicableStepIds: ['step-1'],
              disposition: 'resolved',
              resolvedByStepId: 'step-1',
              resolvedAtCommitCount: 0,
            },
          ],
        })
      );
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      writeRequest(broker.nonce);

      await broker.service();
      broker.close();

      expect(readRunState(dir).commits).toEqual([
        {
          kind: 'landed',
          sha: committed.sha,
          stepIds: ['step-1'],
          issueIds: ['issue-1'],
        },
      ]);
    });

    it('fails without answering when the commit it landed cannot be recorded', async () => {
      mockCommit.mockImplementation(async () => {
        // The run state goes away under the parent between the commit and
        // its record.
        rmSync(join(dir, 'run.json'));
        mkdirSync(join(dir, 'run.json'));
        return committed;
      });
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      const resultPath = writeRequest(broker.nonce);

      await expect(broker.service()).rejects.toThrow();
      broker.close();

      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(existsSync(resultPath)).toBe(false);
    });
  });

  describe('tree reservation', () => {
    const request = { kind: 'commit' as const, stepId: 'step-1', attempt: 1 };
    function held(): MigrateTreeOperation | undefined {
      return readRunState(dir).treeOperation;
    }

    it('reserves the tree for one owner until that owner releases it', () => {
      const lease = acquireTreeOperation(dir, request, 'first');

      expect(held()).toEqual({ ...request, owner: 'first', pid: process.pid });
      // Written with the reservation: the trace a mid-commit death leaves.
      expect(readRunState(dir).steps[0].commitStarted).toBe(true);
      expect(() => acquireTreeOperation(dir, request, 'second')).toThrow(
        TreeBusyError
      );
      // A stranger's release, or a lease released late, keeps the holder.
      releaseTreeOperation(dir, 'second');
      expect(held()?.owner).toBe('first');
      lease.release();
      expect(held()).toBeUndefined();
    });

    it('ignores a reservation whose owner process is gone', () => {
      writeRunState(
        dir,
        runState({
          treeOperation: { ...request, owner: 'gone', pid: 999999 },
        })
      );
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });

      const lease = acquireTreeOperation(dir, request, 'next');

      expect(held()?.owner).toBe('next');
      lease.release();
    });

    it('refuses a request whose step is no longer at its seam', () => {
      writeRunState(dir, runState({ steps: [step({ status: 'succeeded' })] }));

      expect(() => acquireTreeOperation(dir, request, 'late')).toThrow(
        BrokerStaleRequestError
      );
      expect(held()).toBeUndefined();
    });

    it('clears the mark it set on release, and leaves one an earlier commit left behind', () => {
      const own = acquireTreeOperation(dir, request, 'first');
      own.release();
      expect(readRunState(dir).steps[0].commitStarted).toBeUndefined();

      writeRunState(dir, runState({ steps: [step({ commitStarted: true })] }));
      const inherited = acquireTreeOperation(dir, request, 'second');
      inherited.release();
      expect(held()).toBeUndefined();
      expect(readRunState(dir).steps[0].commitStarted).toBe(true);
    });

    it('does not clear the mark of a newer holder through a late release', () => {
      const late = acquireTreeOperation(dir, request, 'first');
      // The first holder's process is gone; a new committer takes over.
      writeRunState(
        dir,
        runState({
          steps: [step({ commitStarted: true })],
          treeOperation: { ...request, owner: 'first', pid: 999999 },
        })
      );
      vi.spyOn(process, 'kill').mockImplementation(((pid: number) => {
        if (pid === 999999) {
          throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
        }
        return true;
      }) as never);
      acquireTreeOperation(dir, request, 'second');

      late.release();

      expect(held()?.owner).toBe('second');
      expect(readRunState(dir).steps[0].commitStarted).toBe(true);
    });

    it.each([
      ['committed', { status: 'committed', sha: 'abc' }, true],
      ['failed', { status: 'failed', reason: 'ENOBUFS' }, true],
      ['no-changes', { status: 'no-changes' }, undefined],
      ['disabled', { status: 'disabled' }, undefined],
    ] as const)(
      'keeps the mark of an in-process commit whose result is %s past the release only when git ran',
      async (_, result, markAfterRelease) => {
        delete process.env.NX_MIGRATE_BROKER;
        const scope: TreeScope = {};

        await commitStepTree(dir, step(), [], async () => result, scope);
        // A landed commit's entry may fail to persist, and a failure once git
        // ran may follow a commit; neither release may clear the mark.
        scope.lease.release();

        expect(held()).toBeUndefined();
        expect(readRunState(dir).steps[0].commitStarted).toBe(markAfterRelease);
      }
    );

    it('hands an in-process seam its lease before the commit runs, and keeps it when the commit throws', async () => {
      delete process.env.NX_MIGRATE_BROKER;
      const scope: TreeScope = {};
      let heldDuringCommit: MigrateTreeOperation | undefined;

      await expect(
        commitStepTree(
          dir,
          step(),
          [],
          async () => {
            heldDuringCommit = held();
            throw new Error('git failed');
          },
          scope
        )
      ).rejects.toThrow('git failed');

      expect(heldDuringCommit?.owner).toBe(scope.lease.owner);
      expect(held()?.owner).toBe(scope.lease.owner);
      scope.lease.release();
      expect(held()).toBeUndefined();
    });

    it('leaves a request for a later pass while another live process holds the tree', async () => {
      writeRunState(
        dir,
        runState({
          treeOperation: { ...request, owner: 'other', pid: process.pid },
        })
      );
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      mkdirSync(brokerDir(dir), { recursive: true });
      const resultPath = join(
        brokerDir(dir),
        `${broker.nonce}-step-1-1-commit.result.json`
      );
      writeFileSync(
        join(brokerDir(dir), `${broker.nonce}-step-1-1-commit.request.json`),
        JSON.stringify(request)
      );

      await broker.service();
      const answeredWhileHeld = existsSync(resultPath);
      releaseTreeOperation(dir, 'other');
      await broker.service();
      broker.close();

      expect(answeredWhileHeld).toBe(false);
      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(existsSync(resultPath)).toBe(true);
    });

    it('holds the tree under its own nonce while answering and releases it after the record', async () => {
      let heldDuringCommit: MigrateTreeOperation | undefined;
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      mockCommit.mockImplementation(async () => {
        heldDuringCommit = held();
        return committed;
      });
      mkdirSync(brokerDir(dir), { recursive: true });
      writeFileSync(
        join(brokerDir(dir), `${broker.nonce}-step-1-1-commit.request.json`),
        JSON.stringify(request)
      );

      await broker.service();

      expect(heldDuringCommit).toEqual({
        ...request,
        owner: broker.nonce,
        pid: process.pid,
      });
      expect(held()).toBeUndefined();
      expect(readRunState(dir).commits).toHaveLength(1);
      broker.close();
    });

    it('releases a reservation the session still holds when it closes', () => {
      const broker = new MigrateCommitBroker(
        root,
        dir,
        'npx nx migrate',
        POLICY
      );
      acquireTreeOperation(dir, request, broker.nonce);

      broker.close();

      expect(held()).toBeUndefined();
    });
  });
});
