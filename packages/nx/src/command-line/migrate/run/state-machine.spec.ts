import type {
  MigrateCommitLedgerEntry,
  MigrateRunState,
  MigrateStep,
  MigrateStepStatus,
} from './run-state';
import {
  applyStepEvent,
  commitResultToLedgerEntry,
  coveringLandedEntries,
  hasPendingCommitDebt,
  stepsToPendingMigrations,
  type StepAction,
  type StepEvent,
} from './state-machine';

const ALL_STEP_STATUSES: MigrateStepStatus[] = [
  'pending',
  'dispensed',
  'running',
  'awaiting-prompt-outcome',
  'succeeded',
  'failed',
  'skipped',
  'died',
];

function stateWithStep(overrides: Partial<MigrateStep> = {}): MigrateRunState {
  return {
    formatVersion: 1,
    runId: 'run-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    nxVersion: '99.9.9',
    mode: 'orchestrated',
    status: 'active',
    createCommits: true,
    commitPrefix: 'chore: [nx migration] ',
    rounds: [],
    steps: [
      {
        id: 'step-1',
        roundIndex: 0,
        kind: 'migration',
        status: 'pending',
        attempt: 1,
        dispenseCount: 0,
        ...overrides,
      },
    ],
    issues: [],
    commits: [],
    analytics: { startEmitted: false, completeEmitted: false },
  };
}

function snapshot(state: MigrateRunState): MigrateRunState {
  return JSON.parse(JSON.stringify(state));
}

// Events legal from exactly one source status.
const SIMPLE_CASES: {
  type: StepEvent['type'];
  buildEvent: (stepId: string) => StepEvent;
  legalFrom: MigrateStepStatus;
  expectedStatus: MigrateStepStatus;
}[] = [
  {
    type: 'dispense',
    buildEvent: (stepId) => ({ type: 'dispense', stepId }),
    legalFrom: 'pending',
    expectedStatus: 'dispensed',
  },
  {
    type: 'start',
    buildEvent: (stepId) => ({
      type: 'start',
      stepId,
      pid: 123,
      startedAt: '2026-01-01T00:01:00.000Z',
    }),
    legalFrom: 'dispensed',
    expectedStatus: 'running',
  },
  {
    type: 'succeed',
    buildEvent: (stepId) => ({
      type: 'succeed',
      stepId,
      finishedAt: '2026-01-01T00:02:00.000Z',
    }),
    legalFrom: 'running',
    expectedStatus: 'succeeded',
  },
  {
    type: 'fail',
    buildEvent: (stepId) => ({
      type: 'fail',
      stepId,
      finishedAt: '2026-01-01T00:02:00.000Z',
    }),
    legalFrom: 'running',
    expectedStatus: 'failed',
  },
  {
    type: 'awaitPromptOutcome',
    buildEvent: (stepId) => ({
      type: 'awaitPromptOutcome',
      stepId,
      finishedAt: '2026-01-01T00:02:00.000Z',
    }),
    legalFrom: 'running',
    expectedStatus: 'awaiting-prompt-outcome',
  },
  {
    type: 'markDied',
    buildEvent: (stepId) => ({ type: 'markDied', stepId }),
    legalFrom: 'running',
    expectedStatus: 'died',
  },
];

describe('applyStepEvent', () => {
  it('rejects an event for a step id that does not exist', () => {
    const state = stateWithStep({ status: 'pending' });
    const result = applyStepEvent(state, {
      type: 'dispense',
      stepId: 'missing',
    });
    expect(result).toEqual({
      kind: 'error',
      reason: expect.stringContaining('missing'),
    });
  });

  describe.each(SIMPLE_CASES)(
    '$type',
    ({ buildEvent, legalFrom, expectedStatus }) => {
      it(`transitions ${legalFrom} -> ${expectedStatus}`, () => {
        const state = stateWithStep({ status: legalFrom });

        const result = applyStepEvent(state, buildEvent('step-1'));

        expect(result.kind).toBe('ok');
        if (result.kind === 'ok') {
          expect(result.state.steps[0].status).toBe(expectedStatus);
        }
      });

      it.each(ALL_STEP_STATUSES.filter((status) => status !== legalFrom))(
        'rejects from %s, leaving the input unchanged',
        (status) => {
          const state = stateWithStep({ status });
          const before = snapshot(state);

          const result = applyStepEvent(state, buildEvent('step-1'));

          expect(result.kind).toBe('error');
          expect(state).toEqual(before);
        }
      );
    }
  );

  describe('markDied', () => {
    it('never marks a step awaiting a prompt outcome as died (no live process to die)', () => {
      const state = stateWithStep({ status: 'awaiting-prompt-outcome' });

      const result = applyStepEvent(state, {
        type: 'markDied',
        stepId: 'step-1',
      });

      expect(result.kind).toBe('error');
    });
  });

  describe('awaitPromptOutcome generatorCompleted', () => {
    it('records generatorCompleted when the event carries it', () => {
      const state = stateWithStep({ status: 'running' });

      const result = applyStepEvent(state, {
        type: 'awaitPromptOutcome',
        stepId: 'step-1',
        finishedAt: '2026-01-01T00:02:00.000Z',
        generatorCompleted: true,
      });

      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.state.steps[0].generatorCompleted).toBe(true);
      }
    });

    it('leaves generatorCompleted unset when the event omits it', () => {
      const state = stateWithStep({ status: 'running' });

      const result = applyStepEvent(state, {
        type: 'awaitPromptOutcome',
        stepId: 'step-1',
        finishedAt: '2026-01-01T00:02:00.000Z',
      });

      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.state.steps[0].generatorCompleted).toBeUndefined();
      }
    });
  });

  describe('foldPromptOutcome', () => {
    it.each([
      ['completed', 'succeeded'],
      ['skipped', 'skipped'],
      ['failed', 'failed'],
    ] as const)(
      'maps promptOutcome %s to step status %s',
      (promptStatus, expectedStatus) => {
        const state = stateWithStep({ status: 'awaiting-prompt-outcome' });

        const result = applyStepEvent(state, {
          type: 'foldPromptOutcome',
          stepId: 'step-1',
          promptOutcome: { status: promptStatus },
        });

        expect(result.kind).toBe('ok');
        if (result.kind === 'ok') {
          expect(result.state.steps[0].status).toBe(expectedStatus);
          expect(result.state.steps[0].promptOutcome).toEqual({
            status: promptStatus,
          });
        }
      }
    );

    it.each(
      ALL_STEP_STATUSES.filter((status) => status !== 'awaiting-prompt-outcome')
    )('rejects from %s, leaving the input unchanged', (status) => {
      const state = stateWithStep({ status });
      const before = snapshot(state);

      const result = applyStepEvent(state, {
        type: 'foldPromptOutcome',
        stepId: 'step-1',
        promptOutcome: { status: 'completed' },
      });

      expect(result.kind).toBe('error');
      expect(state).toEqual(before);
    });
  });

  describe('stepAction', () => {
    const ALL_ACTIONS: StepAction[] = ['retry', 'skip', 'retry-clean', 'adopt'];

    // The only legal (status, action) pairs; every other combination must be
    // rejected. `null` marks an illegal pair.
    const MATRIX: {
      status: MigrateStepStatus;
      action: StepAction;
      expected: MigrateStepStatus | null;
    }[] = ALL_STEP_STATUSES.flatMap((status) =>
      ALL_ACTIONS.map((action) => {
        let expected: MigrateStepStatus | null = null;
        if (status === 'failed' && action === 'retry') expected = 'pending';
        else if (status === 'failed' && action === 'skip') expected = 'skipped';
        else if (status === 'died' && action === 'retry-clean')
          expected = 'pending';
        else if (status === 'died' && action === 'adopt')
          expected = 'succeeded';
        return { status, action, expected };
      })
    );

    it.each(MATRIX)('$action from $status', ({ status, action, expected }) => {
      const state = stateWithStep({ status, attempt: 1 });
      const before = snapshot(state);

      const result = applyStepEvent(state, {
        type: 'stepAction',
        stepId: 'step-1',
        action,
      });

      if (expected === null) {
        expect(result.kind).toBe('error');
        expect(state).toEqual(before);
      } else {
        expect(result.kind).toBe('ok');
        if (result.kind === 'ok') {
          expect(result.state.steps[0].status).toBe(expected);
          if (action === 'retry' || action === 'retry-clean') {
            expect(result.state.steps[0].attempt).toBe(2);
          }
        }
      }
    });

    it.each([
      { status: 'failed' as const, action: 'retry' as const },
      { status: 'died' as const, action: 'retry-clean' as const },
    ])(
      '$action drops the previous attempt fields so a later success cannot carry them',
      ({ status, action }) => {
        const state = stateWithStep({
          status,
          attempt: 1,
          dispenseCount: 3,
          pid: 123,
          startedAt: '2026-01-01T00:01:00.000Z',
          finishedAt: '2026-01-01T00:02:00.000Z',
          gitRefBefore: 'abc123',
          outcome: { summary: 'first attempt failed' },
          promptOutcome: { status: 'failed', summary: 'nope' },
        });

        const result = applyStepEvent(state, {
          type: 'stepAction',
          stepId: 'step-1',
          action,
        });

        expect(result.kind).toBe('ok');
        if (result.kind === 'ok') {
          expect(result.state.steps[0]).toEqual({
            id: 'step-1',
            roundIndex: 0,
            kind: 'migration',
            status: 'pending',
            attempt: 2,
            dispenseCount: 3,
          });
        }
      }
    );

    it('retry from failed keeps generatorCompleted so the retry skips the generator', () => {
      const state = stateWithStep({
        status: 'failed',
        generatorCompleted: true,
      });

      const result = applyStepEvent(state, {
        type: 'stepAction',
        stepId: 'step-1',
        action: 'retry',
      });

      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.state.steps[0].generatorCompleted).toBe(true);
      }
    });

    it('retry-clean preserves generatorCompleted: the reset target postdates the generator commit', () => {
      const state = stateWithStep({
        status: 'died',
        generatorCompleted: true,
      });

      const result = applyStepEvent(state, {
        type: 'stepAction',
        stepId: 'step-1',
        action: 'retry-clean',
      });

      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.state.steps[0].generatorCompleted).toBe(true);
      }
    });

    it('keeps generatorCompleted through a failed handoff, retry, death, and retry-clean', () => {
      // A hybrid whose generator half committed must never re-run it: the
      // marker has to survive the full failure cycle, not just one rearm.
      let state = stateWithStep({ status: 'running' });

      const park = applyStepEvent(state, {
        type: 'awaitPromptOutcome',
        stepId: 'step-1',
        finishedAt: '2026-01-01T00:00:00.000Z',
        generatorCompleted: true,
      });
      expect(park.kind).toBe('ok');
      if (park.kind !== 'ok') return;
      state = park.state;

      const failed = applyStepEvent(state, {
        type: 'foldPromptOutcome',
        stepId: 'step-1',
        promptOutcome: { status: 'failed', summary: 'could not apply' },
      });
      expect(failed.kind).toBe('ok');
      if (failed.kind !== 'ok') return;
      state = failed.state;

      const retried = applyStepEvent(state, {
        type: 'stepAction',
        stepId: 'step-1',
        action: 'retry',
      });
      expect(retried.kind).toBe('ok');
      if (retried.kind !== 'ok') return;
      state = retried.state;
      expect(state.steps[0].generatorCompleted).toBe(true);

      const dispensed = applyStepEvent(state, {
        type: 'dispense',
        stepId: 'step-1',
      });
      expect(dispensed.kind).toBe('ok');
      if (dispensed.kind !== 'ok') return;
      state = dispensed.state;

      const started = applyStepEvent(state, {
        type: 'start',
        stepId: 'step-1',
        pid: 123,
        startedAt: '2026-01-01T00:01:00.000Z',
      });
      expect(started.kind).toBe('ok');
      if (started.kind !== 'ok') return;
      state = started.state;

      const died = applyStepEvent(state, {
        type: 'markDied',
        stepId: 'step-1',
      });
      expect(died.kind).toBe('ok');
      if (died.kind !== 'ok') return;
      state = died.state;

      const cleaned = applyStepEvent(state, {
        type: 'stepAction',
        stepId: 'step-1',
        action: 'retry-clean',
      });
      expect(cleaned.kind).toBe('ok');
      if (cleaned.kind !== 'ok') return;
      expect(cleaned.state.steps[0].generatorCompleted).toBe(true);
      expect(cleaned.state.steps[0].status).toBe('pending');
    });
  });
});

describe('hasPendingCommitDebt', () => {
  function stateWithCommits(
    commits: MigrateCommitLedgerEntry[]
  ): MigrateRunState {
    return { ...stateWithStep(), commits };
  }

  it('is false when a failed entry is covered by a later landed entry for the same step', () => {
    const state = stateWithCommits([
      { kind: 'failed', stepIds: ['step-1'], issueIds: [] },
      { kind: 'landed', sha: 'abc', stepIds: ['step-1'], issueIds: [] },
    ]);

    expect(hasPendingCommitDebt(state)).toBe(false);
  });

  it('is true when a failed entry is never covered by a later landed entry', () => {
    const state = stateWithCommits([
      { kind: 'failed', stepIds: ['step-1'], issueIds: [] },
    ]);

    expect(hasPendingCommitDebt(state)).toBe(true);
  });

  it('ignores checkpoint entries: only a landed entry can cover a failure', () => {
    const state = stateWithCommits([
      { kind: 'checkpoint', sha: 'chk', stepIds: [], issueIds: [] },
      { kind: 'failed', stepIds: ['step-1'], issueIds: [] },
      { kind: 'checkpoint', sha: 'chk2', stepIds: ['step-1'], issueIds: [] },
    ]);

    expect(hasPendingCommitDebt(state)).toBe(true);
  });
});

describe('coveringLandedEntries', () => {
  function stateWithCommits(
    commits: MigrateCommitLedgerEntry[]
  ): MigrateRunState {
    return { ...stateWithStep(), commits };
  }

  it('collects the landed entries naming the step, in ledger order', () => {
    const first: MigrateCommitLedgerEntry = {
      kind: 'landed',
      sha: 'abc',
      stepIds: ['step-1'],
      issueIds: [],
    };
    const second: MigrateCommitLedgerEntry = {
      kind: 'landed',
      sha: 'def',
      stepIds: ['step-2', 'step-1'],
      issueIds: [],
    };
    const state = stateWithCommits([first, second]);

    expect(coveringLandedEntries(state, 'step-1')).toEqual([first, second]);
    expect(coveringLandedEntries(state, 'step-2')).toEqual([second]);
  });

  it('ignores failed and checkpoint entries', () => {
    const state = stateWithCommits([
      { kind: 'checkpoint', sha: 'chk', stepIds: ['step-1'], issueIds: [] },
      { kind: 'failed', stepIds: ['step-1'], issueIds: [] },
    ]);

    expect(coveringLandedEntries(state, 'step-1')).toEqual([]);
  });
});

describe('stepsToPendingMigrations', () => {
  function stateWithSteps(steps: Partial<MigrateStep>[]): MigrateRunState {
    return {
      ...stateWithStep(),
      steps: steps.map((overrides, i) => ({
        id: `step-${i + 1}`,
        roundIndex: 0,
        kind: 'migration' as const,
        status: 'pending' as const,
        attempt: 1,
        dispenseCount: 0,
        ...overrides,
      })),
    };
  }

  it('maps step ids to {package, name}, splitting on the first colon only', () => {
    const state = stateWithSteps([
      { migrationId: '@nx/js:a' },
      { migrationId: '@nx/js:b:with-colon' },
    ]);

    expect(stepsToPendingMigrations(state, ['step-1', 'step-2'])).toEqual([
      { package: '@nx/js', name: 'a' },
      { package: '@nx/js', name: 'b:with-colon' },
    ]);
  });

  it('drops steps without an attributable package', () => {
    const state = stateWithSteps([
      { kind: 'install', migrationId: undefined },
      { migrationId: 'bare-name' },
      { migrationId: ':empty-package' },
      { migrationId: '@nx/js:kept' },
    ]);

    expect(
      stepsToPendingMigrations(state, ['step-1', 'step-2', 'step-3', 'step-4'])
    ).toEqual([{ package: '@nx/js', name: 'kept' }]);
  });
});

describe('commitResultToLedgerEntry', () => {
  it('maps a committed result to a landed entry covering the absorbed steps', () => {
    expect(
      commitResultToLedgerEntry({ status: 'committed', sha: 'abc' }, 'step-2', [
        'step-1',
      ])
    ).toEqual({
      kind: 'landed',
      sha: 'abc',
      stepIds: ['step-2', 'step-1'],
      issueIds: [],
    });
  });

  it('omits the sha when the commit landed without one resolving', () => {
    expect(
      commitResultToLedgerEntry(
        { status: 'committed', sha: null },
        'step-1',
        []
      )
    ).toEqual({ kind: 'landed', stepIds: ['step-1'], issueIds: [] });
  });

  it('maps a failed result to a debt entry naming only this step', () => {
    expect(
      commitResultToLedgerEntry(
        { status: 'failed', reason: 'boom' },
        'step-2',
        ['step-1']
      )
    ).toEqual({ kind: 'failed', stepIds: ['step-2'], issueIds: [] });
  });

  it.each(['no-changes', 'disabled'] as const)(
    'records nothing for %s',
    (status) => {
      expect(commitResultToLedgerEntry({ status }, 'step-1', [])).toBeNull();
    }
  );
});
