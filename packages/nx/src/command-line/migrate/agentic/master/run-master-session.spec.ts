import type { Mock } from 'vitest';

const mockInit = vi.fn();
const mockCompletionWarnings = vi.fn();
vi.mock('../../run/orchestrator', () => ({
  runOrchestratorInit: (...args: unknown[]) => mockInit(...args),
  completionWarnings: (...args: unknown[]) => mockCompletionWarnings(...args),
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

function input(): RunMasterSessionInput {
  return {
    root,
    migrationsJson: { migrations: [] },
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
    mockCompletionWarnings.mockReset().mockReturnValue([]);
    mockReadRunState.mockReset();
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
      createCommits: false,
      commitPrefix: 'chore: [nx migration] ',
      skipInstall: false,
      installedNxVersion: '23.0.0',
      validate: undefined,
      emitAgentInstructions: false,
    });
    expect(mockSpawnMaster).toHaveBeenCalledWith({
      agent: input().agent,
      runRoot: root,
      runId,
      runbookPath: ready.runbookPath,
      reconcileCommand: ready.reconcileCommand,
    });
    expect(mockReadRunState).toHaveBeenCalledWith(
      join(root, '.nx', 'migrate-runs', runId)
    );
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
      bodyLines: ['  applied: 2', '  skipped: 1'],
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

  it('exits 1 with the resume hint and no completion event when the run is still active', async () => {
    mockReadRunState.mockReturnValue(state('active', ['succeeded', 'pending']));

    expect(await runMasterSession(input())).toBe(1);

    expect(warnSpy).toHaveBeenCalledWith({
      title: `Migrate run ${runId} is still active. Run nx migrate --run-migrations --agentic=claude-code again to resume it.`,
    });
    expect(mockRunComplete).not.toHaveBeenCalled();
    expect(mockRunError).not.toHaveBeenCalled();
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
        `Migrate run ${runId} is still active. Run nx migrate --run-migrations --agentic=claude-code again to resume it.`,
      ],
    });
    expect(mockRunError).toHaveBeenCalledWith({ code: 'agentic', error });
    expect(mockReadRunState).not.toHaveBeenCalled();
    expect(mockRunComplete).not.toHaveBeenCalled();
  });
});
