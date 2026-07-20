const mockInit = jest.fn();
const mockDispense = jest.fn();
const mockComplete = jest.fn();
jest.mock('../migrate-analytics', () => ({
  reportMigrateOrchestratorInit: (...args: unknown[]) => mockInit(...args),
  reportMigrateOrchestratorDispense: (...args: unknown[]) =>
    mockDispense(...args),
  reportMigrateOrchestratorComplete: (...args: unknown[]) =>
    mockComplete(...args),
}));

jest.mock('../execute-migration', () => ({
  ChangedDepInstaller: jest.fn().mockImplementation(() => ({
    installDepsIfChanged: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockCommit = jest.fn();
const mockCheckpoint = jest.fn();
jest.mock('../migrate-commits', () => ({
  commitMigrationIfRequested: (...args: unknown[]) => mockCommit(...args),
  commitCheckpointBeforeMigrations: (...args: unknown[]) =>
    mockCheckpoint(...args),
}));

const mockGetLatestCommitSha = jest.fn();
const mockGetPathCommitExposure = jest.fn();
const mockGetWorkingTreeStatus = jest.fn();
const mockIsAncestorCommit = jest.fn();
const mockTryCommitChanges = jest.fn();
jest.mock('../../../utils/git-utils', () => ({
  ...jest.requireActual('../../../utils/git-utils'),
  getLatestCommitSha: (...args: unknown[]) => mockGetLatestCommitSha(...args),
  getPathCommitExposure: (...args: unknown[]) =>
    mockGetPathCommitExposure(...args),
  getWorkingTreeStatus: (...args: unknown[]) =>
    mockGetWorkingTreeStatus(...args),
  // The gitignore fallback invoked at init consumes the boolean probe; keep it
  // coupled to the same tri-state mock.
  hasUncommittedChanges: (...args: unknown[]) =>
    mockGetWorkingTreeStatus(...args) === 'dirty',
  isAncestorCommit: (...args: unknown[]) => mockIsAncestorCommit(...args),
  tryCommitChanges: (...args: unknown[]) => mockTryCommitChanges(...args),
}));

jest.mock('../../../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerCommand: () => ({ exec: 'npx' }),
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
import { dirname, join } from 'path';
import { output } from '../../../utils/output';
import { stepHandoffPath } from '../agentic/handoff';
import { runOrchestratorInit, runOrchestratorReconcile } from './orchestrator';
import { computePlanHash } from './run-id';
import {
  findActiveRun,
  migrateRunsDir,
  readRunState,
  runDir,
  writeRunState,
  type MigrateCommitLedgerEntry,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepStatus,
} from './run-state';

interface ParsedBlock {
  runId: string;
  step: string;
  action: string;
  payload: { command?: string; then?: string; instructions?: string };
}

describe('orchestrator', () => {
  let root: string;
  let stdout: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-migrate-orch-'));
    stdout = '';
    jest.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: unknown
    ) => {
      stdout += String(chunk);
      return true;
    }) as unknown as typeof process.stdout.write);
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});

    mockInit.mockReset();
    mockDispense.mockReset();
    mockComplete.mockReset();
    mockCommit.mockReset().mockResolvedValue({ status: 'no-changes' });
    mockCheckpoint.mockReset();
    mockGetLatestCommitSha.mockReset().mockReturnValue(null);
    mockGetPathCommitExposure.mockReset().mockReturnValue('ignored');
    mockGetWorkingTreeStatus.mockReset().mockReturnValue('clean');
    mockIsAncestorCommit.mockReset().mockReturnValue(false);
    mockTryCommitChanges.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  function parseBlocks(): ParsedBlock[] {
    const re =
      /<nx_migrate_step run-id="([^"]*)" step="([^"]*)" action="([^"]*)">\n([\s\S]*?)\n<\/nx_migrate_step>/g;
    const blocks: ParsedBlock[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(stdout)) !== null) {
      blocks.push({
        runId: m[1],
        step: m[2],
        action: m[3],
        payload: JSON.parse(m[4]),
      });
    }
    return blocks;
  }

  function lastBlock(): ParsedBlock {
    const blocks = parseBlocks();
    return blocks[blocks.length - 1];
  }

  const genMig = (pkg: string, name: string, version = '1.0.0') => ({
    package: pkg,
    name,
    version,
    implementation: `./${name}.js`,
  });
  const promptMig = (pkg: string, name: string, version = '1.0.0') => ({
    package: pkg,
    name,
    version,
    prompt: `prompts/${name}.md`,
  });

  const migStep = (
    id: string,
    migrationId: string,
    status: MigrateStepStatus,
    extra: Partial<MigrateStep> = {}
  ): MigrateStep => ({
    id,
    roundIndex: 0,
    kind: 'migration',
    migrationId,
    status,
    attempt: 1,
    dispenseCount: status === 'pending' ? 0 : 1,
    ...extra,
  });

  function setupRun(
    runId: string,
    opts: {
      steps: MigrateStep[];
      createCommits?: boolean;
      commits?: MigrateCommitLedgerEntry[];
      plan?: unknown[];
      planHash?: string;
      status?: MigrateRunState['status'];
      startEmitted?: boolean;
      completeEmitted?: boolean;
      checkpointFailed?: boolean;
    }
  ): string {
    const dir = runDir(root, runId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'plan-0.json'),
      JSON.stringify({ migrations: opts.plan ?? [] })
    );
    const state: MigrateRunState = {
      formatVersion: 1,
      runId,
      createdAt: '2026-01-01T00:00:00.000Z',
      nxVersion: '1.0.0',
      mode: 'orchestrated',
      status: opts.status ?? 'active',
      createCommits: opts.createCommits ?? false,
      commitPrefix: 'chore: [nx migration] ',
      rounds: [
        {
          index: 0,
          planHash: opts.planHash ?? 'h',
          planSnapshot: 'plan-0.json',
        },
      ],
      steps: opts.steps,
      issues: [],
      commits: opts.commits ?? [],
      ...(opts.checkpointFailed ? { checkpointFailed: true } : {}),
      analytics: {
        startEmitted: opts.startEmitted ?? true,
        completeEmitted: opts.completeEmitted ?? false,
      },
    };
    writeRunState(dir, state);
    return dir;
  }

  function writeHandoff(
    dir: string,
    pkg: string,
    name: string,
    handoff: Record<string, unknown>
  ): void {
    const p = stepHandoffPath(dir, { package: pkg, name });
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(handoff));
  }

  describe('init', () => {
    it('builds the step list, snapshot, planHash and dispenses the first migration after auto-succeeding placeholders', async () => {
      mockGetLatestCommitSha.mockReturnValue('head-sha');
      const migrationsJson = {
        migrations: [
          genMig('@nx/js', 'a', '1.0.0'),
          genMig('@nx/js', 'b', '2.0.0'),
        ],
      };

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: false,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      const active = findActiveRun(root);
      expect(active).not.toBeNull();
      const { runId, state } = active;

      expect(state.steps.map((s) => s.kind)).toEqual([
        'peer-compat',
        'install',
        'migration',
        'migration',
        'final-validation',
      ]);
      expect(state.steps.map((s) => s.id)).toEqual([
        'step-1',
        'step-2',
        'step-3',
        'step-4',
        'step-5',
      ]);
      // Placeholders auto-succeed; the first migration is dispensed with its ref.
      expect(state.steps[0].status).toBe('succeeded');
      expect(state.steps[1].status).toBe('succeeded');
      expect(state.steps[2].status).toBe('dispensed');
      expect(state.steps[2].migrationId).toBe('@nx/js:a');
      expect(state.steps[2].gitRefBefore).toBe('head-sha');

      expect(state.rounds[0].planSnapshot).toBe('plan-0.json');
      expect(state.rounds[0].planHash).toMatch(/^[0-9a-f]{64}$/);
      const snapshot = JSON.parse(
        readFileSync(join(runDir(root, runId), 'plan-0.json'), 'utf-8')
      );
      expect(snapshot.migrations).toHaveLength(2);

      const block = lastBlock();
      expect(block.action).toBe('next-step');
      expect(block.step).toBe('step-3');
      expect(block.payload.command).toBe(
        `NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true npx nx migrate --run-migration=@nx/js:a --run-id=${runId}`
      );
      expect(block.payload.then).toBe(
        `NX_MIGRATE_ORCHESTRATOR=true NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true npx nx migrate --run-id=${runId}`
      );
      expect(mockInit).toHaveBeenCalledWith({
        migrationCount: 2,
        createCommits: false,
      });
    });

    it('records a checkpoint ledger entry when a checkpoint commit lands', async () => {
      mockGetWorkingTreeStatus
        .mockReturnValueOnce('dirty')
        .mockReturnValue('clean');
      mockGetLatestCommitSha
        .mockReturnValueOnce('before-sha') // before checkpoint
        .mockReturnValue('checkpoint-sha'); // after checkpoint and dispense ref

      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).toHaveBeenCalledWith(
        root,
        'chore: [nx migration] '
      );
      const { state } = findActiveRun(root);
      expect(state.commits).toContainEqual({
        kind: 'checkpoint',
        sha: 'checkpoint-sha',
        stepIds: [],
        issueIds: [],
      });
    });

    it('runs the checkpoint before the run directory exists so its git add -A cannot track run scratch', async () => {
      let runDirsAtCheckpoint: number | undefined;
      mockCheckpoint.mockImplementation(() => {
        runDirsAtCheckpoint = existsSync(migrateRunsDir(root))
          ? readdirSync(migrateRunsDir(root)).length
          : 0;
      });
      mockGetWorkingTreeStatus
        .mockReturnValueOnce('dirty')
        .mockReturnValue('clean');
      mockGetLatestCommitSha
        .mockReturnValueOnce('before-sha')
        .mockReturnValue('checkpoint-sha');

      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(runDirsAtCheckpoint).toBe(0);
    });

    it('records no checkpoint entry and skips the commit on a clean tree', async () => {
      mockGetLatestCommitSha.mockReturnValue('same-sha');

      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).not.toHaveBeenCalled();
      const { state } = findActiveRun(root);
      expect(state.commits.some((c) => c.kind === 'checkpoint')).toBe(false);
      expect(state.checkpointFailed).toBeUndefined();
    });

    it('marks the run when the tree is dirty but the checkpoint commit does not land', async () => {
      // commitCheckpointBeforeMigrations swallows commit failures with a
      // warning; a still-dirty tree afterwards is the only evidence.
      mockGetWorkingTreeStatus.mockReturnValue('dirty');
      mockGetLatestCommitSha.mockReturnValue('same-sha');

      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).toHaveBeenCalledTimes(1);
      const { state } = findActiveRun(root);
      expect(state.commits.some((c) => c.kind === 'checkpoint')).toBe(false);
      expect(state.checkpointFailed).toBe(true);
    });

    it('marks the run when the working-tree probe fails, so an unverified tree cannot enable clean retries', async () => {
      // A failed `git status` must not read as a clean tree: nothing was
      // checkpointed, so a later retry-clean reset would destroy the user's
      // pre-run work with no restore point.
      mockGetWorkingTreeStatus.mockReturnValue('unknown');
      mockGetLatestCommitSha.mockReturnValue(null);

      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      const { state } = findActiveRun(root);
      expect(state.commits.some((c) => c.kind === 'checkpoint')).toBe(false);
      expect(state.checkpointFailed).toBe(true);
    });

    it('adds the .gitignore entry at init when the hoisted ignore migration is planned but has not run yet', async () => {
      // The run dir is created before any migration executes; without the
      // entry, a retry-clean's `git clean` or a checkpoint retry could eat the
      // run's own scratch.
      writeFileSync(join(root, '.gitignore'), 'node_modules\n');

      await runOrchestratorInit({
        root,
        migrationsJson: {
          migrations: [
            genMig('nx', '23-0-0-add-migrate-runs-to-git-ignore', '23.0.0'),
            genMig('@nx/js', 'a'),
          ],
        },
        createCommits: false,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(readFileSync(join(root, '.gitignore'), 'utf-8')).toContain(
        '.nx/migrate-runs'
      );
    });

    function activeRunDirNames(): string[] {
      // The creation lock file lives alongside the run dirs; only count dirs.
      return readdirSync(migrateRunsDir(root), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    }

    it('resumes a same-plan run created by a concurrent init instead of creating a competing run', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      // Simulate a concurrent init winning the race between this init's
      // advisory active-run check and its run creation: the checkpoint's tree
      // probe is the first git side effect on the fresh path, so a competitor
      // materializing during it postdates the advisory check.
      mockGetWorkingTreeStatus.mockImplementationOnce(() => {
        setupRun('competitor-run', {
          steps: [migStep('step-1', '@nx/js:a', 'pending')],
          planHash: computePlanHash(migrationsJson),
        });
        return 'clean';
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(activeRunDirNames()).toEqual(['competitor-run']);
      expect(lastBlock().runId).toBe('competitor-run');
    });

    it('refuses under the creation lock when a concurrent init created a run with a different plan', async () => {
      mockGetWorkingTreeStatus.mockImplementationOnce(() => {
        setupRun('competitor-run', {
          steps: [migStep('step-1', '@nx/js:a', 'pending')],
          planHash: 'a-different-plan-hash',
        });
        return 'clean';
      });

      await expect(
        runOrchestratorInit({
          root,
          migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
          createCommits: true,
          commitPrefix: 'chore: [nx migration] ',
          installedNxVersion: '23.0.0',
        })
      ).rejects.toThrow(/already active with a different plan/);

      expect(activeRunDirNames()).toEqual(['competitor-run']);
    });

    it('re-emits instead of failing when a concurrent process dispensed the step first', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });
      // The dispense's pre-migration ref read is the last git side effect
      // before its state write; a concurrent dispense landing there postdates
      // this init's read of the step as pending.
      mockGetLatestCommitSha.mockImplementationOnce(() => {
        writeRunState(dir, {
          ...readRunState(dir),
          steps: [
            migStep('step-1', '@nx/js:a', 'dispensed', {
              gitRefBefore: 'their-sha',
            }),
          ],
        });
        return null;
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: false,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      const block = lastBlock();
      expect(block.action).toBe('next-step');
      expect(block.step).toBe('step-1');
      // The concurrent dispense's ref survives; this init did not re-dispense.
      const step = readRunState(dir).steps[0];
      expect(step.gitRefBefore).toBe('their-sha');
      expect(step.dispenseCount).toBe(1);
    });

    it('no-ops the placeholder drive when a concurrent process already advanced it', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      const placeholder: MigrateStep = {
        id: 'step-1',
        roundIndex: 0,
        kind: 'peer-compat',
        status: 'pending',
        attempt: 1,
        dispenseCount: 0,
      };
      const dir = setupRun('run-1', {
        steps: [placeholder, migStep('step-2', '@nx/js:a', 'pending')],
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
        startEmitted: false,
      });
      // The init-analytics report fires between the watermark claim and the
      // placeholder drive; a concurrent process advancing the run there makes
      // this init's in-memory snapshot stale.
      mockInit.mockImplementationOnce(() => {
        writeRunState(dir, {
          ...readRunState(dir),
          steps: [
            { ...placeholder, status: 'succeeded', dispenseCount: 1 },
            migStep('step-2', '@nx/js:a', 'dispensed'),
          ],
        });
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: false,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      const block = lastBlock();
      expect(block.action).toBe('next-step');
      expect(block.step).toBe('step-2');
      expect(readRunState(dir).steps[0].status).toBe('succeeded');
    });

    describe('on Windows', () => {
      const originalPlatform = process.platform;

      afterEach(() => {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
        });
      });

      it('refuses init and reconcile loudly instead of dispensing POSIX-only commands', async () => {
        Object.defineProperty(process, 'platform', { value: 'win32' });

        // toThrow(Error) asserts message equality, so a stray restart
        // instruction appended to either message fails the test.
        await expect(
          runOrchestratorInit({
            root,
            migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
            createCommits: false,
            commitPrefix: 'chore: [nx migration] ',
            installedNxVersion: '23.0.0',
          })
        ).rejects.toThrow(
          new Error(
            'The orchestrated migrate flow is not supported on Windows yet. Unset NX_MIGRATE_ORCHESTRATOR to use the standard migrate flow.'
          )
        );
        expect(findActiveRun(root)).toBeNull();

        // The standard flow cannot continue an orchestrated run, so the
        // reconcile remediation is continue-elsewhere or abandon, not the
        // init fallback.
        await expect(
          runOrchestratorReconcile({ root, runId: 'run-1' })
        ).rejects.toThrow(
          new Error(
            'The orchestrated migrate flow is not supported on Windows yet. This run cannot be continued on Windows. Continue it from a non-Windows environment, or delete its directory under .nx/migrate-runs to abandon it; migrations it already applied remain applied.'
          )
        );
      });
    });

    it('refuses a migration id that is not shell-safe, naming it', async () => {
      await expect(
        runOrchestratorInit({
          root,
          migrationsJson: {
            migrations: [genMig('@nx/js', "evil'; rm -rf ~")],
          },
          createCommits: false,
          commitPrefix: 'chore: [nx migration] ',
          installedNxVersion: '23.0.0',
        })
      ).rejects.toThrow(
        `The migration id '@nx/js:evil'; rm -rf ~' contains characters that are not shell-safe`
      );
      expect(findActiveRun(root)).toBeNull();
    });

    it('resumes the active run when init re-runs with the same plan', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      mockGetWorkingTreeStatus
        .mockReturnValueOnce('dirty')
        .mockReturnValue('clean');
      mockGetLatestCommitSha
        .mockReturnValueOnce('before-sha')
        .mockReturnValue('checkpoint-sha');
      const initInput = {
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      };
      await runOrchestratorInit(initInput);
      const { runId } = findActiveRun(root);
      stdout = '';

      await runOrchestratorInit(initInput);

      expect(findActiveRun(root).runId).toBe(runId);
      expect(activeRunDirNames()).toEqual([runId]);
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockCheckpoint).toHaveBeenCalledTimes(1);
      const block = lastBlock();
      expect(block.runId).toBe(runId);
      expect(block.action).toBe('next-step');
    });

    it('validates migration ids on resume too, before deciding to resume', async () => {
      const migrationsJson = {
        migrations: [genMig('@nx/js', "evil'; rm -rf ~")],
      };
      setupRun('run-1', {
        steps: [migStep('step-1', "@nx/js:evil'; rm -rf ~", 'pending')],
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });

      await expect(
        runOrchestratorInit({
          root,
          migrationsJson,
          createCommits: false,
          commitPrefix: 'chore: [nx migration] ',
          installedNxVersion: '23.0.0',
        })
      ).rejects.toThrow(
        `The migration id '@nx/js:evil'; rm -rf ~' contains characters that are not shell-safe`
      );
    });

    it('prefers the plan-mismatch error over the unsafe-id error, since that plan never runs', async () => {
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        planHash: computePlanHash({ migrations: [genMig('@nx/js', 'a')] }),
        plan: [genMig('@nx/js', 'a')],
      });

      await expect(
        runOrchestratorInit({
          root,
          migrationsJson: { migrations: [genMig('@nx/js', "evil'; rm -rf ~")] },
          createCommits: false,
          commitPrefix: 'chore: [nx migration] ',
          installedNxVersion: '23.0.0',
        })
      ).rejects.toThrow(
        `A migrate run 'run-1' is already active with a different plan`
      );
    });

    it('throws on init when the active run has a different plan, naming the run', async () => {
      await runOrchestratorInit({
        root,
        migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
        createCommits: false,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });
      const { runId } = findActiveRun(root);

      await expect(
        runOrchestratorInit({
          root,
          migrationsJson: { migrations: [genMig('@nx/js', 'b')] },
          createCommits: false,
          commitPrefix: 'chore: [nx migration] ',
          installedNxVersion: '23.0.0',
        })
      ).rejects.toThrow(
        `A migrate run '${runId}' is already active with a different plan`
      );
    });

    it('retries the failed init checkpoint on resume and clears the flag when it lands', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      mockGetWorkingTreeStatus
        .mockReturnValueOnce('dirty')
        .mockReturnValue('clean');
      mockGetLatestCommitSha
        .mockReturnValueOnce('before-sha')
        .mockReturnValue('checkpoint-sha');
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        createCommits: true,
        checkpointFailed: true,
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).toHaveBeenCalledTimes(1);
      const state = readRunState(dir);
      expect(state.checkpointFailed).toBe(false);
      expect(state.commits.some((c) => c.kind === 'checkpoint')).toBe(true);
    });

    it('keeps the checkpointFailed flag on resume when the working-tree probe fails', async () => {
      // A failed probe proves nothing was captured; clearing the flag on it
      // would re-enable clean retries with no restore point.
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      mockGetWorkingTreeStatus.mockReturnValue('unknown');
      mockGetLatestCommitSha.mockReturnValue(null);
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        createCommits: true,
        checkpointFailed: true,
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      const state = readRunState(dir);
      expect(state.checkpointFailed).toBe(true);
      expect(state.commits.some((c) => c.kind === 'checkpoint')).toBe(false);
    });

    it('does not checkpoint on resume when the run started from a clean tree', async () => {
      // A crash after createRun leaves an unflagged run with no checkpoint
      // entry; retrying there would commit the run's own scratch.
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      mockGetWorkingTreeStatus.mockReturnValue('dirty');
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        createCommits: true,
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).not.toHaveBeenCalled();
    });

    it('does not checkpoint on resume once a migration step has advanced', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'dispensed')],
        createCommits: true,
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
      });

      await runOrchestratorInit({
        root,
        migrationsJson,
        createCommits: true,
        commitPrefix: 'chore: [nx migration] ',
        installedNxVersion: '23.0.0',
      });

      expect(mockCheckpoint).not.toHaveBeenCalled();
    });
  });

  describe('scratch-dir safety probe', () => {
    const initInput = (createCommits: boolean, migrationsJson: unknown) => ({
      root,
      migrationsJson: migrationsJson as { migrations?: unknown[] },
      createCommits,
      commitPrefix: 'chore: [nx migration] ',
      installedNxVersion: '23.0.0',
    });

    it('refuses a fresh init when scratch files are tracked, before any git side effect', async () => {
      mockGetPathCommitExposure.mockReturnValue('tracked');

      await expect(
        runOrchestratorInit(
          initInput(true, { migrations: [genMig('@nx/js', 'a')] })
        )
      ).rejects.toThrow(/git rm -r --cached \.nx\/migrate-runs/);

      expect(mockCheckpoint).not.toHaveBeenCalled();
      expect(findActiveRun(root)).toBeNull();
    });

    it('refuses a fresh init when the probe cannot establish safety', async () => {
      mockGetPathCommitExposure.mockReturnValue('unknown');

      await expect(
        runOrchestratorInit(
          initInput(true, { migrations: [genMig('@nx/js', 'a')] })
        )
      ).rejects.toThrow(/Could not verify with git/);

      expect(mockCheckpoint).not.toHaveBeenCalled();
      expect(findActiveRun(root)).toBeNull();
    });

    it('refuses a fresh init when scratch stays unignored after the fallback had its chance', async () => {
      // v23+ without the entry planned: the fallback respects the conscious
      // removal, so coverage cannot appear and the run must not start.
      mockGetPathCommitExposure.mockReturnValue('unignored');

      await expect(
        runOrchestratorInit(
          initInput(true, { migrations: [genMig('@nx/js', 'a')] })
        )
      ).rejects.toThrow(/not ignored by git/);

      expect(mockGetPathCommitExposure).toHaveBeenCalledTimes(2);
      expect(mockCheckpoint).not.toHaveBeenCalled();
      expect(findActiveRun(root)).toBeNull();
    });

    it('proceeds when the fallback repairs missing ignore coverage, with the entry in place before the checkpoint', async () => {
      writeFileSync(join(root, '.gitignore'), 'node_modules\n');
      mockGetPathCommitExposure
        .mockReturnValueOnce('unignored')
        .mockReturnValue('ignored');
      mockGetWorkingTreeStatus
        .mockReturnValueOnce('dirty')
        .mockReturnValue('clean');
      let checkpointSawEntry: boolean | undefined;
      mockCheckpoint.mockImplementation(() => {
        checkpointSawEntry = readFileSync(
          join(root, '.gitignore'),
          'utf-8'
        ).includes('.nx/migrate-runs');
      });

      await runOrchestratorInit({
        ...initInput(true, { migrations: [genMig('@nx/js', 'a')] }),
        // Pre-v23 nx: the inline fallback applies the entry.
        installedNxVersion: '22.5.0',
      });

      expect(checkpointSawEntry).toBe(true);
      // The fallback's standalone commit is suppressed; the checkpoint
      // carries the .gitignore edit.
      expect(mockTryCommitChanges).not.toHaveBeenCalled();
      expect(findActiveRun(root)).not.toBeNull();
    });

    it('skips the probe when the run does not create commits', async () => {
      await runOrchestratorInit(
        initInput(false, { migrations: [genMig('@nx/js', 'a')] })
      );

      expect(mockGetPathCommitExposure).not.toHaveBeenCalled();
      expect(findActiveRun(root)).not.toBeNull();
    });

    it('refuses a resume when scratch became unsafe while the run was paused, before the checkpoint retry', async () => {
      const migrationsJson = { migrations: [genMig('@nx/js', 'a')] };
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        planHash: computePlanHash(migrationsJson),
        plan: migrationsJson.migrations,
        createCommits: true,
        checkpointFailed: true,
      });
      mockGetPathCommitExposure.mockReturnValue('tracked');

      await expect(
        runOrchestratorInit(initInput(true, migrationsJson))
      ).rejects.toThrow(/continue run 'run-1'/);

      // The checkpoint retry (a `git add -A` commit) must not have run.
      expect(mockCheckpoint).not.toHaveBeenCalled();
    });

    it('refuses a reconcile when scratch became unsafe while the run was paused, before folding handoffs', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'failed')],
        createCommits: true,
      });
      const before = readRunState(dir);
      mockGetPathCommitExposure.mockReturnValue('unignored');

      await expect(
        runOrchestratorReconcile({ root, runId: 'run-1' })
      ).rejects.toThrow(/not ignored by git/);

      expect(readRunState(dir)).toEqual(before);
      expect(parseBlocks()).toHaveLength(0);
    });

    it('skips the probe on reconcile when the run does not create commits', async () => {
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(mockGetPathCommitExposure).not.toHaveBeenCalled();
    });
  });

  describe('reconcile: fold handoffs', () => {
    it.each([
      [{ status: 'success', summary: 'done' }, 'succeeded'],
      [{ status: 'success', summary: 'n/a', outcome: 'skipped' }, 'skipped'],
      [{ status: 'failed', summary: 'boom' }, 'failed'],
    ] as const)(
      'folds handoff %j into step status %s',
      async (handoff, expected) => {
        const dir = setupRun('run-1', {
          steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
          plan: [promptMig('@nx/js', 'p')],
        });
        writeHandoff(dir, '@nx/js', 'p', handoff);

        await runOrchestratorReconcile({ root, runId: 'run-1' });

        expect(readRunState(dir).steps[0].status).toBe(expected);
      }
    );

    it('removes the handoff file once its outcome is folded', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
        plan: [promptMig('@nx/js', 'p')],
      });
      writeHandoff(dir, '@nx/js', 'p', { status: 'failed', summary: 'boom' });
      const handoffPath = stepHandoffPath(dir, {
        package: '@nx/js',
        name: 'p',
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('failed');
      expect(existsSync(handoffPath)).toBe(false);
    });

    it('leaves a step awaiting and dispenses a settle instruction when no handoff exists', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
        plan: [promptMig('@nx/js', 'p')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('awaiting-prompt-outcome');
      const block = lastBlock();
      expect(block.action).toBe('await-prompt');
      expect(block.payload.instructions).toContain('awaiting your outcome');
      expect(block.payload.instructions).toContain(
        stepHandoffPath(dir, { package: '@nx/js', name: 'p' })
      );
    });

    it('names the parse error when a corrupt handoff blocks the fold so the run cannot livelock', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
        plan: [promptMig('@nx/js', 'p')],
      });
      const handoffPath = stepHandoffPath(dir, {
        package: '@nx/js',
        name: 'p',
      });
      mkdirSync(dirname(handoffPath), { recursive: true });
      writeFileSync(handoffPath, '{ not valid json');

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      // The bad handoff does not fold; the dispense tells the agent to rewrite
      // it rather than re-emitting the same await forever.
      expect(readRunState(dir).steps[0].status).toBe('awaiting-prompt-outcome');
      const block = lastBlock();
      expect(block.action).toBe('await-prompt');
      expect(block.payload.instructions).toContain('rejected');
      expect(block.payload.instructions).toContain('invalid JSON');
      expect(block.payload.instructions).toContain('Rewrite the handoff file');
    });
  });

  describe('reconcile: death detection', () => {
    it('marks a running step with a dead pid as died and offers retry-clean when commits give a restore point', async () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      mockGetLatestCommitSha.mockReturnValue('head-now');
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('died');
      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).toContain('ref-before');
      expect(block.payload.instructions).toContain('head-now');
      expect(block.payload.instructions).toContain('working tree');
      expect(block.payload.instructions).toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=retry-clean');
    });

    it('offers only adopt when the run has no restore point (commits disabled)', async () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: false,
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('died');
      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).toContain(
        'clean retry is unavailable'
      );
      expect(block.payload.instructions).not.toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=adopt');
    });

    it('offers only adopt when a prior commit is still pending debt', async () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:prior', 'skipped'),
          migStep('step-2', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        commits: [{ kind: 'failed', stepIds: ['step-1'], issueIds: [] }],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).not.toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=adopt');
    });

    it('offers only adopt when the init checkpoint failed to land', async () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        checkpointFailed: true,
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).not.toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=adopt');
    });

    it('offers only adopt when the dead step has no captured pre-migration ref', async () => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
          }),
        ],
        createCommits: true,
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).not.toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=adopt');
    });

    it('offers only adopt when the died step is already covered by a landed ledger entry, naming the commit', async () => {
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'died', {
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        commits: [
          {
            kind: 'landed',
            sha: 'landed-sha',
            stepIds: ['step-1'],
            issueIds: [],
          },
        ],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('died');
      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).toContain(
        'A clean retry is unavailable'
      );
      expect(block.payload.instructions).toContain('landed-sha');
      expect(block.payload.instructions).not.toContain('retry-clean');
      expect(block.payload.then).toContain('--step-action=adopt');
    });

    it('rejects retry-clean when the died step is already covered by a landed ledger entry, leaving state untouched', async () => {
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'died', {
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        commits: [
          {
            kind: 'landed',
            sha: 'landed-sha',
            stepIds: ['step-1'],
            issueIds: [],
          },
        ],
        plan: [genMig('@nx/js', 'gen')],
      });
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'retry-clean',
      });

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      const block = lastBlock();
      expect(block.action).toBe('error');
      expect(block.payload.instructions).toContain('already landed');
      expect(block.payload.instructions).toContain('landed-sha');
    });

    it('accepts adopt when the died step is already covered by a landed ledger entry, leaving the ledger unchanged', async () => {
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'died', {
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        commits: [
          {
            kind: 'landed',
            sha: 'landed-sha',
            stepIds: ['step-1'],
            issueIds: [],
          },
        ],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'adopt',
      });

      const state = readRunState(dir);
      expect(state.steps[0].status).toBe('succeeded');
      expect(state.commits).toEqual([
        {
          kind: 'landed',
          sha: 'landed-sha',
          stepIds: ['step-1'],
          issueIds: [],
        },
      ]);
    });

    it('still offers retry-clean when a landed commit from an earlier attempt predates the captured ref', async () => {
      // A retried step re-captures gitRefBefore after the earlier attempt's
      // commit landed, so resetting to it keeps that commit in history.
      mockIsAncestorCommit.mockReturnValue(true);
      setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'died', {
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        commits: [
          {
            kind: 'landed',
            sha: 'landed-sha',
            stepIds: ['step-1'],
            issueIds: [],
          },
        ],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('died');
      expect(block.payload.instructions).toContain('retry-clean:');
      expect(block.payload.then).toContain('--step-action=retry-clean');
      expect(mockIsAncestorCommit).toHaveBeenCalledWith(
        'landed-sha',
        'ref-before',
        root
      );
    });

    it('rejects retry-clean when the run has no restore point, leaving state untouched', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'died')],
        createCommits: false,
        plan: [genMig('@nx/js', 'gen')],
      });
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'retry-clean',
      });

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      const block = lastBlock();
      expect(block.action).toBe('error');
      expect(block.payload.instructions).toContain(
        'no restore point accounts for'
      );
    });

    it('re-validates markDied against fresh state, leaving a step that finished on disk succeeded', async () => {
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 999999,
            startedAt: '2026-01-01T00:00:00.000Z',
            gitRefBefore: 'ref-before',
          }),
        ],
        createCommits: true,
        plan: [genMig('@nx/js', 'gen')],
      });
      // The reconcile snapshot reads the step running with a dead pid. Model the
      // worker finishing concurrently: when death detection probes the pid, flip
      // the on-disk step to succeeded so the fresh-state markDied is illegal and
      // dropped rather than clobbering the worker's write.
      jest.spyOn(process, 'kill').mockImplementation(((_pid: number) => {
        const s = readRunState(dir);
        writeRunState(dir, {
          ...s,
          steps: [{ ...s.steps[0], status: 'succeeded' as const }],
        });
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      }) as never);

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('succeeded');
    });

    it('leaves a running step with a live pid untouched and dispenses still-running', async () => {
      jest.spyOn(process, 'kill').mockReturnValue(true as never);
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 4242,
            startedAt: new Date().toISOString(),
          }),
        ],
        plan: [genMig('@nx/js', 'gen')],
      });
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      const block = lastBlock();
      expect(block.action).toBe('still-running');
      expect(block.payload.instructions).not.toContain('may be hung');
    });

    it('escalates a still-running step older than the hang threshold', async () => {
      jest.spyOn(process, 'kill').mockReturnValue(true as never);
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'running', {
            pid: 4242,
            startedAt: twentyMinAgo,
          }),
        ],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(lastBlock().payload.instructions).toContain('may be hung');
    });
  });

  describe('reconcile: step-action', () => {
    it('re-arms a failed step on retry and dispenses it again', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'failed')],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'retry',
      });

      const step = readRunState(dir).steps[0];
      expect(step.attempt).toBe(2);
      expect(step.status).toBe('dispensed');
      expect(lastBlock().action).toBe('next-step');
    });

    it('rejects an illegal action, emitting an error dispense and leaving state untouched', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'failed')],
        plan: [genMig('@nx/js', 'gen')],
      });
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'adopt', // only retry/skip are legal from failed
      });

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      expect(lastBlock().action).toBe('error');
    });

    it('errors when no failed or died step exists to target', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'succeeded')],
        plan: [genMig('@nx/js', 'gen')],
      });
      const before = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'retry',
      });

      expect(readFileSync(join(dir, 'run.json'), 'utf-8')).toBe(before);
      const block = lastBlock();
      expect(block.action).toBe('error');
      expect(block.payload.instructions).toContain('No step is failed or died');
    });

    it('adopts a died step and commits its working tree at reconcile', async () => {
      jest.spyOn(process, 'kill').mockReturnValue(true as never);
      mockCommit.mockResolvedValue({ status: 'committed', sha: 'adopt-sha' });
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'died')],
        createCommits: true,
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'adopt',
      });

      const state = readRunState(dir);
      expect(state.steps[0].status).toBe('succeeded');
      expect(state.commits).toContainEqual({
        kind: 'landed',
        sha: 'adopt-sha',
        stepIds: ['step-1'],
        issueIds: [],
      });
    });

    it('does not refold a stale handoff after a retry re-arms the step', async () => {
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'failed')],
        plan: [promptMig('@nx/js', 'p')],
      });
      // Stale handoff from the failed attempt, still on disk.
      writeHandoff(dir, '@nx/js', 'p', {
        status: 'failed',
        summary: 'old attempt',
      });

      await runOrchestratorReconcile({
        root,
        runId: 'run-1',
        stepAction: 'retry',
      });

      expect(
        existsSync(stepHandoffPath(dir, { package: '@nx/js', name: 'p' }))
      ).toBe(false);

      // Simulate the retried worker parking the step again; the agent has not
      // written a new handoff yet.
      const state = readRunState(dir);
      writeRunState(dir, {
        ...state,
        steps: state.steps.map((s) => ({
          ...s,
          status: 'awaiting-prompt-outcome' as const,
        })),
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(readRunState(dir).steps[0].status).toBe('awaiting-prompt-outcome');
      expect(lastBlock().action).toBe('await-prompt');
    });
  });

  describe('reconcile: retry-failed dispense', () => {
    it('surfaces the failed step outcome summary and offers only retry or skip', async () => {
      setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:gen', 'failed', {
            outcome: { summary: 'boom: the generator broke' },
          }),
        ],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('retry-failed');
      expect(block.payload.instructions).toContain('boom: the generator broke');
      expect(block.payload.instructions).toContain('retry:');
      expect(block.payload.instructions).toContain('skip:');
      expect(block.payload.instructions).not.toContain('defer');
    });
  });

  describe('reconcile: dispense exhaustiveness', () => {
    it('refuses a persisted unknown step status at read time instead of stalling silently', async () => {
      // The closed-set validation in readRunState catches this before any
      // dispense logic runs; the dispense switch's own unrecognized-status
      // throw remains as defense against in-memory drift.
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:a', 'pending')],
        plan: [genMig('@nx/js', 'a')],
      });
      const state = readRunState(dir);
      writeRunState(dir, {
        ...state,
        steps: [
          {
            ...state.steps[0],
            status: 'paused' as unknown as MigrateStepStatus,
          },
        ],
      });

      await expect(
        runOrchestratorReconcile({ root, runId: 'run-1' })
      ).rejects.toThrow(/corrupt run state/i);
    });
  });

  describe('reconcile: commit folding', () => {
    it('commits a folded prompt step, absorbing prior uncovered failed step ids', async () => {
      mockCommit.mockResolvedValue({ status: 'committed', sha: 'newsha' });
      const dir = setupRun('run-1', {
        steps: [
          migStep('step-1', '@nx/js:prior', 'skipped'),
          migStep('step-2', '@nx/js:p', 'awaiting-prompt-outcome'),
        ],
        createCommits: true,
        commits: [{ kind: 'failed', stepIds: ['step-1'], issueIds: [] }],
        plan: [promptMig('@nx/js', 'p')],
      });
      writeHandoff(dir, '@nx/js', 'p', { status: 'success', summary: 'ok' });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      // Absorbed step reaches the commit body via the pending arg.
      expect(mockCommit.mock.calls[0][5]).toEqual([
        { package: '@nx/js', name: 'prior' },
      ]);
      expect(readRunState(dir).commits).toContainEqual({
        kind: 'landed',
        sha: 'newsha',
        stepIds: ['step-2', 'step-1'],
        issueIds: [],
      });
    });
  });

  describe('reconcile: complete', () => {
    it('sets status completed and emits the completion analytics exactly once across two reconciles', async () => {
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'succeeded')],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });
      const afterFirst = readRunState(runDir(root, 'run-1'));
      expect(afterFirst.status).toBe('completed');
      expect(afterFirst.analytics.completeEmitted).toBe(true);
      expect(lastBlock().action).toBe('complete');

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      expect(mockComplete).toHaveBeenCalledTimes(1);
    });

    it('warns about outstanding commit debt when the tree is dirty', async () => {
      mockGetWorkingTreeStatus.mockReturnValue('dirty');
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'succeeded')],
        createCommits: true,
        commits: [{ kind: 'failed', stepIds: ['step-1'], issueIds: [] }],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const state = readRunState(runDir(root, 'run-1'));
      expect(state.status).toBe('completed');
      const block = lastBlock();
      expect(block.action).toBe('complete');
      expect(block.payload.instructions).toContain('could not be committed');
      expect(output.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('could not be committed'),
        })
      );
    });

    it('does not warn about commit debt when the tree is clean', async () => {
      // A stranded failed entry from the crash-refold window; the diff was in
      // fact absorbed, so the tree is clean.
      mockGetWorkingTreeStatus.mockReturnValue('clean');
      setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:gen', 'succeeded')],
        createCommits: true,
        commits: [{ kind: 'failed', stepIds: ['step-1'], issueIds: [] }],
        plan: [genMig('@nx/js', 'gen')],
      });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const block = lastBlock();
      expect(block.action).toBe('complete');
      expect(block.payload.instructions).not.toContain(
        'could not be committed'
      );
    });

    it('errors when the run does not exist', async () => {
      await expect(
        runOrchestratorReconcile({ root, runId: 'missing' })
      ).rejects.toThrow(/No migrate run 'missing' was found/);
    });

    it.each(['../escape', '..', '.'])(
      'rejects the unsafe run id %s',
      async (runId) => {
        await expect(runOrchestratorReconcile({ root, runId })).rejects.toThrow(
          `Invalid run id '${runId}'.`
        );
      }
    );
  });

  describe('reconcile: resume idempotency', () => {
    it('does not double-transition or double-commit on a second identical reconcile', async () => {
      mockCommit.mockResolvedValue({ status: 'committed', sha: 'sha-1' });
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
        createCommits: true,
        plan: [promptMig('@nx/js', 'p')],
      });
      writeHandoff(dir, '@nx/js', 'p', { status: 'success', summary: 'ok' });

      await runOrchestratorReconcile({ root, runId: 'run-1' });
      const landedAfterFirst = readRunState(dir).commits.filter(
        (c) => c.kind === 'landed'
      );

      await runOrchestratorReconcile({ root, runId: 'run-1' });
      const landedAfterSecond = readRunState(dir).commits.filter(
        (c) => c.kind === 'landed'
      );

      expect(landedAfterFirst).toHaveLength(1);
      expect(landedAfterSecond).toHaveLength(1);
      expect(mockCommit).toHaveBeenCalledTimes(1);
      expect(readRunState(dir).steps[0].status).toBe('succeeded');
    });

    it('refolds after a crash between the git commit and the state write without a duplicate commit', async () => {
      mockCommit
        .mockResolvedValueOnce({ status: 'committed', sha: 'sha-1' })
        .mockResolvedValue({ status: 'no-changes' });
      const dir = setupRun('run-1', {
        steps: [migStep('step-1', '@nx/js:p', 'awaiting-prompt-outcome')],
        createCommits: true,
        plan: [promptMig('@nx/js', 'p')],
      });
      writeHandoff(dir, '@nx/js', 'p', { status: 'success', summary: 'ok' });
      const preCrash = readFileSync(join(dir, 'run.json'), 'utf-8');

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      // Crash simulation: the git commit landed but the process died before
      // the state write, so the step is still awaiting and the handoff is
      // still on disk. The retried commit then sees a clean tree.
      writeFileSync(join(dir, 'run.json'), preCrash);
      writeHandoff(dir, '@nx/js', 'p', { status: 'success', summary: 'ok' });

      await runOrchestratorReconcile({ root, runId: 'run-1' });

      const state = readRunState(dir);
      expect(state.steps[0].status).toBe('succeeded');
      // 'no-changes' records nothing; the ledger just misses the landed entry.
      expect(state.commits).toEqual([]);
      expect(mockCommit).toHaveBeenCalledTimes(2);
    });
  });

  it('prunes nothing and keeps the run dir under .nx/migrate-runs', async () => {
    await runOrchestratorInit({
      root,
      migrationsJson: { migrations: [genMig('@nx/js', 'a')] },
      createCommits: false,
      commitPrefix: 'chore: [nx migration] ',
      installedNxVersion: '23.0.0',
    });
    expect(findActiveRun(root)).not.toBeNull();
    expect(migrateRunsDir(root)).toContain(join('.nx', 'migrate-runs'));
  });
});
