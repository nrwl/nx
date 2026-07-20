// Pure step-level transition function: no fs/process/Date access. Callers
// pass timestamps in event payloads so this stays deterministic and testable
// without touching the clock.
import type { CommitResult } from '../migrate-commits';
import type {
  MigrateCommitLedgerEntry,
  MigrateRunState,
  MigrateStep,
  MigrateStepOutcome,
  MigrateStepPromptOutcome,
} from './run-state';
import type { StepAction } from '../step-actions';

export type { StepAction };

export type StepEvent =
  | { type: 'dispense'; stepId: string }
  | { type: 'start'; stepId: string; pid: number; startedAt: string }
  | {
      type: 'succeed';
      stepId: string;
      finishedAt: string;
      outcome?: MigrateStepOutcome;
    }
  | {
      type: 'fail';
      stepId: string;
      finishedAt: string;
      outcome?: MigrateStepOutcome;
    }
  | {
      type: 'awaitPromptOutcome';
      stepId: string;
      finishedAt: string;
      // Set when the hybrid generator half ran before parking for the prompt.
      generatorCompleted?: boolean;
    }
  | {
      type: 'foldPromptOutcome';
      stepId: string;
      promptOutcome: MigrateStepPromptOutcome;
    }
  | { type: 'markDied'; stepId: string }
  | { type: 'stepAction'; stepId: string; action: StepAction };

// A string discriminant, not a boolean `ok`: this repo compiles without
// strictNullChecks, where a boolean discriminant does not narrow and every
// consumer would need a cast.
export type ApplyStepEventResult =
  | { kind: 'ok'; state: MigrateRunState }
  | { kind: 'error'; reason: string };

const PROMPT_OUTCOME_TO_STEP_STATUS: Record<
  MigrateStepPromptOutcome['status'],
  MigrateStep['status']
> = {
  completed: 'succeeded',
  skipped: 'skipped',
  failed: 'failed',
};

export function applyStepEvent(
  state: MigrateRunState,
  event: StepEvent
): ApplyStepEventResult {
  const index = state.steps.findIndex((s) => s.id === event.stepId);
  if (index === -1) {
    return {
      kind: 'error',
      reason: `No step with id '${event.stepId}' in run state.`,
    };
  }
  const step = state.steps[index];

  switch (event.type) {
    case 'dispense':
      // 'failed' and 'died' steps are re-armed to 'pending' by a stepAction
      // first; this event never dispenses them directly.
      if (step.status !== 'pending') return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: 'dispensed',
        dispenseCount: step.dispenseCount + 1,
      });

    case 'start':
      if (step.status !== 'dispensed') return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: 'running',
        pid: event.pid,
        startedAt: event.startedAt,
      });

    case 'succeed':
      if (step.status !== 'running') return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: 'succeeded',
        finishedAt: event.finishedAt,
        ...(event.outcome ? { outcome: event.outcome } : {}),
      });

    case 'fail':
      if (step.status !== 'running') return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: 'failed',
        finishedAt: event.finishedAt,
        ...(event.outcome ? { outcome: event.outcome } : {}),
      });

    case 'awaitPromptOutcome':
      if (step.status !== 'running') return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: 'awaiting-prompt-outcome',
        finishedAt: event.finishedAt,
        ...(event.generatorCompleted ? { generatorCompleted: true } : {}),
      });

    case 'foldPromptOutcome':
      if (step.status !== 'awaiting-prompt-outcome')
        return illegal(step, event.type);
      return commit(state, index, {
        ...step,
        status: PROMPT_OUTCOME_TO_STEP_STATUS[event.promptOutcome.status],
        promptOutcome: event.promptOutcome,
      });

    case 'markDied':
      // A step awaiting a prompt outcome has no live process left to die;
      // only a running step can.
      if (step.status !== 'running') return illegal(step, event.type);
      return commit(state, index, { ...step, status: 'died' });

    case 'stepAction':
      return applyStepAction(state, index, step, event.action);

    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

function applyStepAction(
  state: MigrateRunState,
  index: number,
  step: MigrateStep,
  action: StepAction
): ApplyStepEventResult {
  if (step.status === 'failed') {
    switch (action) {
      case 'retry':
        return commit(state, index, rearm(step));
      case 'skip':
        return commit(state, index, { ...step, status: 'skipped' });
    }
  }
  if (step.status === 'died') {
    switch (action) {
      case 'retry-clean':
        return commit(state, index, rearm(step));
      case 'adopt':
        return commit(state, index, { ...step, status: 'succeeded' });
    }
  }
  return {
    kind: 'error',
    reason: `Cannot apply action '${action}' to step '${step.id}' in status '${step.status}'.`,
  };
}

// Re-arms a step for a fresh attempt. Drops every field the previous attempt
// wrote (pid, timestamps, git ref, outcomes) so a later success can't carry a
// stale failure outcome; dispenseCount stays cumulative across attempts.
// The generator-completed marker survives every rearm: with commits on, any
// retry-clean reset target postdates the generator commit; with commits off
// the orchestrator never offers a reset. Either way the generator's changes
// are still in the tree, so re-running it would apply them twice.
function rearm(step: MigrateStep): MigrateStep {
  return {
    id: step.id,
    roundIndex: step.roundIndex,
    kind: step.kind,
    ...(step.migrationId !== undefined
      ? { migrationId: step.migrationId }
      : {}),
    status: 'pending',
    attempt: step.attempt + 1,
    dispenseCount: step.dispenseCount,
    ...(step.generatorCompleted ? { generatorCompleted: true } : {}),
  };
}

function illegal(
  step: MigrateStep,
  eventType: StepEvent['type']
): ApplyStepEventResult {
  return {
    kind: 'error',
    reason: `Cannot apply '${eventType}' to step '${step.id}' in status '${step.status}'.`,
  };
}

function commit(
  state: MigrateRunState,
  index: number,
  updatedStep: MigrateStep
): ApplyStepEventResult {
  const nextSteps = state.steps.slice();
  nextSteps[index] = updatedStep;
  return { kind: 'ok', state: { ...state, steps: nextSteps } };
}

// Step ids named by a 'failed' ledger entry with no later 'landed' entry
// covering them.
export function uncoveredFailedStepIds(state: MigrateRunState): string[] {
  const uncovered = new Set<string>();
  const { commits } = state;
  for (let i = 0; i < commits.length; i++) {
    if (commits[i].kind !== 'failed') continue;
    for (const stepId of commits[i].stepIds) {
      const covered = commits
        .slice(i + 1)
        .some((c) => c.kind === 'landed' && c.stepIds.includes(stepId));
      if (!covered) uncovered.add(stepId);
    }
  }
  return [...uncovered];
}

/**
 * A step has commit debt when a 'failed' ledger entry names it and no later
 * 'landed' entry also names it (checkpoint entries neither create nor cover
 * debt). There is no per-step commit object; debt is always derived from the
 * ledger.
 */
export function hasPendingCommitDebt(state: MigrateRunState): boolean {
  return uncoveredFailedStepIds(state).length > 0;
}

// The 'landed' ledger entries naming the given step, in ledger order.
export function coveringLandedEntries(
  state: MigrateRunState,
  stepId: string
): MigrateCommitLedgerEntry[] {
  return state.commits.filter(
    (commit) => commit.kind === 'landed' && commit.stepIds.includes(stepId)
  );
}

// The round with the highest index.
export function latestRound(
  state: MigrateRunState
): MigrateRunState['rounds'][number] | undefined {
  return state.rounds.reduce<MigrateRunState['rounds'][number] | undefined>(
    (newest, round) => (!newest || round.index > newest.index ? round : newest),
    undefined
  );
}

// '<package>:<name>' splits on the first ':', leaving names that contain a ':'
// intact; a bare id has no package.
export function splitMigrationId(id: string): {
  package: string;
  name: string;
} {
  const colon = id.indexOf(':');
  return colon === -1
    ? { package: '', name: id }
    : { package: id.slice(0, colon), name: id.slice(colon + 1) };
}

// Maps absorbed step ids to `{package, name}` for the commit body; steps
// without a migrationId (or without a package in it) can't be attributed
// there.
export function stepsToPendingMigrations(
  state: MigrateRunState,
  stepIds: string[]
): { package: string; name: string }[] {
  const pending: { package: string; name: string }[] = [];
  for (const id of stepIds) {
    const migrationId = state.steps.find((s) => s.id === id)?.migrationId;
    if (!migrationId) continue;
    const { package: pkg, name } = splitMigrationId(migrationId);
    if (!pkg) continue;
    pending.push({ package: pkg, name });
  }
  return pending;
}

/**
 * Classifies a commit attempt into the ledger entry to record, or null when
 * there is nothing to record ('no-changes' / 'disabled'). A landed entry
 * covers the absorbed steps too: the commit's `git add -A` captured their
 * diffs. A failed entry records only this step's debt.
 */
export function commitResultToLedgerEntry(
  result: CommitResult,
  stepId: string,
  absorbedStepIds: string[]
): MigrateCommitLedgerEntry | null {
  switch (result.status) {
    case 'committed':
      return {
        kind: 'landed',
        ...(result.sha ? { sha: result.sha } : {}),
        stepIds: [stepId, ...absorbedStepIds],
        issueIds: [],
      };
    case 'failed':
      return { kind: 'failed', stepIds: [stepId], issueIds: [] };
    case 'no-changes':
    case 'disabled':
      return null;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
