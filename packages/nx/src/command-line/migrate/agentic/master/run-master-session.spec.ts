import type { Mock } from 'vitest';

const mockInit = vi.fn();
const mockResume = vi.fn();
const mockCompletionWarnings = vi.fn();
vi.mock('../../run/orchestrator', () => ({
  runOrchestratorInit: (...args: unknown[]) => mockInit(...args),
  runOrchestratorResume: (...args: unknown[]) => mockResume(...args),
  completionWarnings: (...args: unknown[]) => mockCompletionWarnings(...args),
}));
const mockCanPrompt = vi.fn();
const mockChoice = vi.fn();
vi.mock('../../safe-prompt', () => ({
  canPrompt: (...args: unknown[]) => mockCanPrompt(...args),
  migrateChoice: (...args: unknown[]) => mockChoice(...args),
}));
const mockReadRunState = vi.fn();
vi.mock('../../run/run-state', async () => ({
  ...(await vi.importActual('../../run/run-state')),
  readRunState: (...args: unknown[]) => mockReadRunState(...args),
}));

const mockSpawnMaster = vi.fn();
vi.mock('./spawn-master', () => ({
  spawnMasterSession: (...args: unknown[]) => mockSpawnMaster(...args),
}));

const mockRunComplete = vi.fn();
const mockRunError = vi.fn();
vi.mock('../../migrate-analytics', () => ({
  reportMigrateRunComplete: (...args: unknown[]) => mockRunComplete(...args),
  reportMigrateRunError: (...args: unknown[]) => mockRunError(...args),
}));

import { join } from 'path';
import { output } from '../../../../utils/output';
import type { ExistingRunFacts } from '../../run/existing-run-report';
import { MigrateRunState } from '../../run/run-state';
import { runMasterSession, RunMasterSessionInput } from './run-master-session';

const root = '/workspace';
const runId = '20260715T101530-3f9a1c02';
const ready = {
  kind: 'ready' as const,
  runId,
  runRoot: root,
  runbookPath: join(root, '.nx', 'migrate-runs', runId, 'RUNBOOK.md'),
  reconcileCommand: `npx nx migrate --run-id=${runId}`,
};

const confirmNewRun = vi.fn();

function input(): RunMasterSessionInput {
  return {
    confirmNewRun,
    root,
    migrationsJson: { migrations: [] },
    migrationsPath: 'migrations.json',
    createCommits: false,
    commitPrefix: 'chore: [nx migration] ',
    skipInstall: false,
    installedNxVersion: '23.0.0',
    validate: undefined,
    agent: {
      id: 'claude-code',
      displayName: 'Claude Code',
      binary: '/usr/local/bin/claude',
      source: 'path',
    },
  };
}

const facts: ExistingRunFacts = {
  runId,
  createdAt: '2026-01-01T00:00:00.000Z',
  recordedBranch: 'main',
  currentBranch: 'main',
  progress: {
    applied: 1,
    adopted: 0,
    skipped: 0,
    unresolved: [],
    remaining: 2,
    stalled: 0,
  },
  unresolvedIssues: 0,
  policy: { createCommits: false, skipInstall: false },
  commits: { recorded: 0, reachable: 0, unchecked: 0, newest: null },
  liveWorkers: [],
  otherActiveRuns: [],
  appliedStillPlanned: 1,
};
const existing = { kind: 'existing-run' as const, runId, facts };
const continueCommand = `npx nx migrate --run-migrations --agentic=claude-code --run-id=${runId} --no-create-commits`;
const startFreshCommand =
  'npx nx migrate --run-migrations --agentic=claude-code --start-fresh';

function state(
  status: MigrateRunState['status'],
  stepStatuses: MigrateRunState['steps'][number]['status'][]
): MigrateRunState {
  return {
    status,
    steps: stepStatuses.map((s) => ({ status: s })),
  } as MigrateRunState;
}

describe('runMasterSession', () => {
  let logSpy: Mock;
  let warnSpy: Mock;
  let errorSpy: Mock;

  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(ready);
    mockResume.mockReset().mockReturnValue(ready);
    mockCanPrompt.mockReset().mockReturnValue(false);
    mockChoice.mockReset();
    mockCompletionWarnings.mockReset().mockReturnValue([]);
    mockReadRunState.mockReset();
    confirmNewRun.mockReset().mockResolvedValue(true);
    mockSpawnMaster.mockReset().mockResolvedValue({ kind: 'exited' });
    mockRunComplete.mockReset();
    mockRunError.mockReset();
    logSpy = vi.spyOn(output, 'log').mockImplementation(() => {}) as Mock;
    warnSpy = vi.spyOn(output, 'warn').mockImplementation(() => {}) as Mock;
    errorSpy = vi.spyOn(output, 'error').mockImplementation(() => {}) as Mock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function everythingPrinted(): string {
    return [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .map(([opts]) => [opts.title, ...(opts.bodyLines ?? [])].join('\n'))
      .join('\n');
  }

  it('inits without agent instructions and hands the ready run to one session', async () => {
    mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

    await runMasterSession(input());

    expect(mockInit).toHaveBeenCalledWith({
      root,
      migrationsJson: { migrations: [] },
      migrationsPath: 'migrations.json',
      createCommits: false,
      commitPrefix: 'chore: [nx migration] ',
      skipInstall: false,
      installedNxVersion: '23.0.0',
      validate: undefined,
      emitAgentInstructions: false,
      onExistingRun: 'report',
      confirmStart: confirmNewRun,
    });
    expect(mockResume).not.toHaveBeenCalled();
    expect(mockSpawnMaster).toHaveBeenCalledWith({
      agent: input().agent,
      runRoot: root,
      runId,
      runbookPath: ready.runbookPath,
      reconcileCommand: ready.reconcileCommand,
      policy: { createCommits: false, skipInstall: false },
    });
    expect(mockReadRunState).toHaveBeenCalledWith(
      join(root, '.nx', 'migrate-runs', runId)
    );
  });

  it('continues the run --run-id names instead of initializing, without the new-run confirmation', async () => {
    mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

    await runMasterSession({ ...input(), runId });

    expect(confirmNewRun).not.toHaveBeenCalled();
    expect(mockInit).not.toHaveBeenCalled();
    expect(mockResume).toHaveBeenCalledWith({
      root,
      runId,
      policy: { createCommits: false, skipInstall: false },
      emitAgentInstructions: false,
    });
    expect(mockSpawnMaster).toHaveBeenCalled();
  });

  it('asks init to start fresh for --start-fresh, with the new-run confirmation', async () => {
    mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

    await runMasterSession({ ...input(), startFresh: true });

    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        onExistingRun: 'start-fresh',
        confirmStart: confirmNewRun,
      })
    );
  });

  describe('an active run found where a new one would start', () => {
    beforeEach(() => {
      mockInit.mockResolvedValueOnce(existing);
    });

    it('exits 1 with the report and both commands when it cannot ask', async () => {
      mockCanPrompt.mockReturnValue(false);

      expect(await runMasterSession({ ...input(), interactive: false })).toBe(
        1
      );

      expect(mockCanPrompt).toHaveBeenCalledWith(false);
      expect(warnSpy).toHaveBeenCalledWith({
        title: `A migrate run is already active: ${runId}`,
        bodyLines: expect.arrayContaining([
          `  run: ${runId}`,
          '  progress: 1 applied, 0 skipped, 2 remaining',
          `To continue the run: ${continueCommand}`,
          `To start fresh (deletes the run record, then runs the whole plan again): ${startFreshCommand}`,
        ]),
      });
      expect(mockChoice).not.toHaveBeenCalled();
      expect(mockSpawnMaster).not.toHaveBeenCalled();
      expect(mockRunError).not.toHaveBeenCalled();
    });

    it("renders the recorded policy on the continue command, not this invocation's", async () => {
      mockCanPrompt.mockReturnValue(false);
      mockInit.mockReset();
      mockInit.mockResolvedValueOnce({
        ...existing,
        facts: { ...facts, policy: { createCommits: true, skipInstall: true } },
      });

      await runMasterSession({ ...input(), interactive: false });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            `To continue the run: npx nx migrate --run-migrations --agentic=claude-code --run-id=${runId} --create-commits --skip-install`,
          ]),
        })
      );
    });

    it('repeats a non-default migrations path in the start-fresh command', async () => {
      mockCanPrompt.mockReturnValue(false);

      await runMasterSession({
        ...input(),
        migrationsPath: 'tools/migrations.json',
        interactive: false,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            `To continue the run: ${continueCommand}`,
            'To start fresh (deletes the run record, then runs the whole plan again): npx nx migrate --run-migrations=tools/migrations.json --agentic=claude-code --start-fresh',
          ]),
        })
      );
    });

    it('shows the report and asks, continue first, on a terminal', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('abort');

      await runMasterSession(input());

      expect(logSpy).toHaveBeenCalledWith({
        title: `A migrate run is already active: ${runId}`,
        bodyLines: expect.not.arrayContaining([
          expect.stringContaining('To continue the run'),
        ]),
      });
      expect(mockChoice).toHaveBeenCalledWith({
        message: 'What do you want to do with the active migrate run?',
        choices: [
          expect.objectContaining({ value: 'continue' }),
          expect.objectContaining({
            value: 'start-fresh',
            hint: 'deletes the run record only; the whole plan runs again',
          }),
          expect.objectContaining({ value: 'abort' }),
        ],
      });
    });

    it('continues the run in-process when asked to', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('continue');
      mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

      expect(await runMasterSession(input())).toBeUndefined();

      expect(mockResume).toHaveBeenCalledWith({
        root,
        runId,
        policy: { createCommits: false, skipInstall: false },
        emitAgentInstructions: false,
      });
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockSpawnMaster).toHaveBeenCalled();
    });

    it('continues under the recorded policy when it differs from this invocation, through resume, the broker and the resume hint', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('continue');
      mockInit.mockReset();
      mockInit.mockResolvedValueOnce({
        ...existing,
        facts: { ...facts, policy: { createCommits: true, skipInstall: true } },
      });
      mockReadRunState.mockReturnValue(
        state('active', ['succeeded', 'pending'])
      );

      expect(await runMasterSession(input())).toBe(1);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            '  policy: per-migration commits on, installs skipped',
          ]),
        })
      );
      expect(mockChoice).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              value: 'continue',
              hint: 'picks the run up where it stopped, keeping its recorded commit and install policy',
            }),
          ]),
        })
      );
      expect(mockResume).toHaveBeenCalledWith({
        root,
        runId,
        policy: { createCommits: true, skipInstall: true },
        emitAgentInstructions: false,
      });
      expect(mockSpawnMaster).toHaveBeenCalledWith(
        expect.objectContaining({
          policy: { createCommits: true, skipInstall: true },
        })
      );
      expect(warnSpy).toHaveBeenCalledWith({
        title: `Migrate run ${runId} is still active. Run npx nx migrate --run-migrations --agentic=claude-code --run-id=${runId} --create-commits --skip-install to continue it.`,
      });
    });

    it('starts fresh in-process when asked to, replacing only the reported run and handing init the new-run confirmation', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('start-fresh');
      mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

      expect(await runMasterSession(input())).toBeUndefined();

      expect(mockInit).toHaveBeenCalledTimes(2);
      expect(mockInit).toHaveBeenLastCalledWith(
        expect.objectContaining({
          onExistingRun: 'start-fresh',
          replaceRunId: runId,
          confirmStart: confirmNewRun,
        })
      );
      expect(mockResume).not.toHaveBeenCalled();
      expect(mockSpawnMaster).toHaveBeenCalled();
    });

    it('spawns nothing when init refuses the start-fresh choice', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('start-fresh');
      mockInit.mockResolvedValueOnce({ kind: 'refused' });

      expect(await runMasterSession(input())).toBeUndefined();

      expect(mockInit).toHaveBeenCalledTimes(2);
      expect(mockSpawnMaster).not.toHaveBeenCalled();
    });

    it('exits 0 leaving the run alone when the user aborts', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('abort');

      expect(await runMasterSession(input())).toBeUndefined();

      expect(logSpy).toHaveBeenCalledWith({
        title: `Leaving migrate run ${runId} as it is. Run ${continueCommand} to continue it.`,
      });
      expect(mockResume).not.toHaveBeenCalled();
      expect(mockSpawnMaster).not.toHaveBeenCalled();
      expect(mockReadRunState).not.toHaveBeenCalled();
    });

    it('exits 1 with the report when another run appeared after the decision', async () => {
      mockCanPrompt.mockReturnValue(true);
      mockChoice.mockResolvedValue('start-fresh');
      mockInit.mockResolvedValueOnce({
        ...existing,
        runId: 'other-run',
        facts: { ...facts, runId: 'other-run' },
      });

      expect(await runMasterSession(input())).toBe(1);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'A migrate run is already active: other-run',
        })
      );
      expect(mockSpawnMaster).not.toHaveBeenCalled();
    });
  });

  it('spawns nothing when init refuses', async () => {
    mockInit.mockResolvedValue({ kind: 'refused' });

    expect(await runMasterSession(input())).toBeUndefined();

    expect(mockSpawnMaster).not.toHaveBeenCalled();
    expect(mockRunComplete).not.toHaveBeenCalled();
  });

  it('exits 0 with the tally and the completion event when the run completed', async () => {
    mockReadRunState.mockReturnValue(
      state('completed', ['succeeded', 'skipped', 'succeeded'])
    );

    expect(await runMasterSession(input())).toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is complete.`,
      bodyLines: [
        '  applied: 2',
        '  adopted: 0',
        '  skipped: 1',
        '  unresolved: 0',
      ],
    });
    expect(mockRunComplete).toHaveBeenCalledWith({
      agenticOutcome: 'enabled',
      agentUsed: 'claude-code',
      migrationCount: 3,
      appliedCount: 2,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns with what the completed run left behind', async () => {
    const completed = state('completed', ['succeeded', 'failed']);
    mockReadRunState.mockReturnValue(completed);
    mockCompletionWarnings.mockReturnValue([
      [
        'Some migration changes could not be committed and may remain in the working tree; review and commit them manually.',
      ],
      ['1 issue remains unresolved:', '  - a: needs a decision'],
    ]);

    expect(await runMasterSession(input())).toBeUndefined();

    expect(mockCompletionWarnings).toHaveBeenCalledWith(root, runId, completed);
    expect(warnSpy.mock.calls).toEqual([
      [
        {
          title:
            'Some migration changes could not be committed and may remain in the working tree; review and commit them manually.',
          bodyLines: [],
        },
      ],
      [
        {
          title: '1 issue remains unresolved:',
          bodyLines: ['  - a: needs a decision'],
        },
      ],
    ]);
    expect(mockRunComplete).toHaveBeenCalled();
  });

  it('exits 1 with the tally, each given-up migration and its failure when the completed run left a step unresolved', async () => {
    mockReadRunState.mockReturnValue({
      status: 'completed',
      steps: [
        { status: 'succeeded' },
        { status: 'succeeded', adopted: true },
        {
          status: 'unresolved',
          migrationId: '@nx/js:gen',
          // Agent text is printed verbatim, so its breaks are collapsed.
          outcome: { summary: 'boom: the generator\u2028broke\n\nbadly' },
        },
      ],
    } as MigrateRunState);

    expect(await runMasterSession(input())).toBe(1);

    expect(logSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is complete.`,
      bodyLines: [
        '  applied: 1',
        '  adopted: 1',
        '  skipped: 0',
        '  unresolved: 1',
        '    - @nx/js:gen: boom: the generator broke badly',
      ],
    });
    expect(warnSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} left work unresolved; exiting with code 1.`,
    });
    expect(everythingPrinted()).not.toContain('resume');
    expect(mockRunComplete).toHaveBeenCalledWith({
      agenticOutcome: 'enabled',
      agentUsed: 'claude-code',
      migrationCount: 3,
      appliedCount: 2,
    });
  });

  it.each([
    ['exits 1', 'deferred-final', 1],
    ['exits 1', 'recorded', 1],
    ['exits 0', 'resolved', undefined],
  ] as const)(
    '%s when every step succeeded and the only reported issue is %s',
    async (_case, disposition, exitCode) => {
      mockReadRunState.mockReturnValue({
        status: 'completed',
        steps: [{ status: 'succeeded' }],
        issues: [{ id: 'issue-1', disposition }],
      } as MigrateRunState);

      expect(await runMasterSession(input())).toBe(exitCode);
    }
  );

  it('exits 1 with the resume hint and no completion event when the run is still active', async () => {
    mockReadRunState.mockReturnValue(state('active', ['succeeded', 'pending']));

    expect(await runMasterSession(input())).toBe(1);

    expect(warnSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is still active. Run ${continueCommand} to continue it.`,
    });
    expect(mockRunComplete).not.toHaveBeenCalled();
    expect(mockRunError).not.toHaveBeenCalled();
  });

  it('renders the policy this session ran with on the resume hint', async () => {
    mockReadRunState.mockReturnValue(state('active', ['succeeded', 'pending']));

    expect(
      await runMasterSession({
        ...input(),
        createCommits: true,
        skipInstall: true,
      })
    ).toBe(1);

    expect(warnSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is still active. Run npx nx migrate --run-migrations --agentic=claude-code --run-id=${runId} --create-commits --skip-install to continue it.`,
    });
  });

  it('exits 1 without a resume hint when run state cannot be read', async () => {
    mockReadRunState.mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory, open run.json');
    });

    expect(await runMasterSession(input())).toBe(1);

    expect(errorSpy).toHaveBeenCalledWith({
      title: `Nx could not determine whether migrate run ${runId} completed.`,
      bodyLines: ['ENOENT: no such file or directory, open run.json'],
    });
    expect(everythingPrinted()).not.toContain('resume');
    expect(mockRunComplete).not.toHaveBeenCalled();
  });

  it('exits 1 with the error, the error event and the resume hint when the agent cannot start', async () => {
    const error = new Error('spawn claude ENOENT');
    mockSpawnMaster.mockResolvedValue({ kind: 'spawn-failed', error });

    expect(await runMasterSession(input())).toBe(1);

    expect(errorSpy).toHaveBeenCalledWith({
      title: 'Could not start Claude Code: spawn claude ENOENT',
      bodyLines: [
        `Migrate run ${runId} is still active. Run ${continueCommand} to continue it.`,
      ],
    });
    expect(mockRunError).toHaveBeenCalledWith({ code: 'agentic', error });
    expect(mockReadRunState).not.toHaveBeenCalled();
    expect(mockRunComplete).not.toHaveBeenCalled();
  });
  it('exits 1 with the error, the error event and the resume hint when the session had to be closed on an unanswered request and the run is still active', async () => {
    const error = new Error('EACCES: permission denied, rename');
    mockSpawnMaster.mockResolvedValue({ kind: 'broker-failed', error });
    mockReadRunState.mockReturnValue(state('active', ['running']));

    expect(await runMasterSession(input())).toBe(1);

    expect(errorSpy).toHaveBeenCalledWith({
      title:
        "Closed the Claude Code session: a step's request could not be answered (EACCES: permission denied, rename).",
    });
    expect(warnSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is still active. Run ${continueCommand} to continue it.`,
    });
    expect(mockRunError).toHaveBeenCalledWith({ code: 'agentic', error });
    expect(mockRunComplete).not.toHaveBeenCalled();
  });

  it('exits 0 with the tally and no resume hint when the session had to be closed on an unanswered request but the run completed', async () => {
    const error = new Error('EACCES: permission denied, scandir');
    mockSpawnMaster.mockResolvedValue({ kind: 'broker-failed', error });
    mockReadRunState.mockReturnValue(state('completed', ['succeeded']));

    expect(await runMasterSession(input())).toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith({
      title:
        "Closed the Claude Code session: a step's request could not be answered (EACCES: permission denied, scandir).",
    });
    expect(mockRunError).toHaveBeenCalledWith({ code: 'agentic', error });
    expect(logSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is complete.`,
      bodyLines: [
        '  applied: 1',
        '  adopted: 0',
        '  skipped: 0',
        '  unresolved: 0',
      ],
    });
    expect(everythingPrinted()).not.toContain('resume');
    expect(mockRunComplete).toHaveBeenCalledWith({
      agenticOutcome: 'enabled',
      agentUsed: 'claude-code',
      migrationCount: 1,
      appliedCount: 1,
    });
  });

  it('exits 1 without a resume hint when the session had to be closed on an unanswered request and run state cannot be read', async () => {
    const error = new Error('ENOENT: no such file or directory, open run.json');
    mockSpawnMaster.mockResolvedValue({ kind: 'broker-failed', error });
    mockReadRunState.mockImplementation(() => {
      throw error;
    });

    expect(await runMasterSession(input())).toBe(1);

    expect(errorSpy).toHaveBeenCalledWith({
      title:
        "Closed the Claude Code session: a step's request could not be answered (ENOENT: no such file or directory, open run.json).",
    });
    expect(errorSpy).toHaveBeenCalledWith({
      title: `Nx could not determine whether migrate run ${runId} completed.`,
      bodyLines: ['ENOENT: no such file or directory, open run.json'],
    });
    expect(everythingPrinted()).not.toContain('resume');
    expect(mockRunError).toHaveBeenCalledWith({ code: 'agentic', error });
    expect(mockRunComplete).not.toHaveBeenCalled();
  });
});
