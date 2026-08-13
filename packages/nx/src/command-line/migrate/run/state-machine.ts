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
    }
  // `foldPromptOutcome` and `markDied` carry the attempt they were observed
  // on. Both are written after an unlocked read, and both source statuses
  // recur across attempts, so the status alone cannot say which attempt the
  // observation was about.
  | {
      type: 'foldPromptOutcome';
      stepId: string;
      attempt: number;
      promptOutcome: MigrateStepPromptOutcome;
    }
  // Emitted between the generator half and the commit attempt, so a retry
  // after a failed commit or install does not reapply the generator.
  | { type: 'markGeneratorCompleted'; stepId: string }
  | { type: 'markDied'; stepId: string; attempt: number }
  | { type: 'stepAction'; stepId: string; action: StepAction };

// A string discriminant, not a boolean `ok`: this repo compiles without
// strictNullChecks, where `if (result.ok)` does not narrow a boolean
// discriminant and every consumer would need `=== true` comparisons.
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
      });

    case 'markGeneratorCompleted':
      if (step.status !== 'running') return illegal(step, event.type);
      return commit(state, index, { ...step, generatorCompleted: true });

    case 'foldPromptOutcome':
      if (step.status !== 'awaiting-prompt-outcome')
        return illegal(step, event.type);
      if (step.attempt !== event.attempt)
        return staleAttempt(step, event.type, event.attempt);
      return commit(state, index, {
        ...step,
        status: PROMPT_OUTCOME_TO_STEP_STATUS[event.promptOutcome.status],
        promptOutcome: event.promptOutcome,
      });

    case 'markDied':
      // A step awaiting a prompt outcome has no live process left to die;
      // only a running step can.
      if (step.status !== 'running') return illegal(step, event.type);
      if (step.attempt !== event.attempt)
        return staleAttempt(step, event.type, event.attempt);
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
        // Nothing resets the tree, so the generator's changes are still in it.
        return commit(state, index, rearm(step, true));
      case 'retry-clean':
        // A failed generator can have written before throwing (a direct fs or
        // exec side effect, or a crash mid-flush), so a reset-backed retry is
        // offered under the same guard as for a death.
        return commit(state, index, cleanRearm(state, step));
      case 'skip':
        return commit(state, index, { ...step, status: 'skipped' });
    }
  }
  if (step.status === 'died') {
    switch (action) {
      case 'retry':
        // Same no-reset rearm as from 'failed', and legal only once the
        // generator half is recorded: that is what leaves the redispensed
        // worker something to do (a hybrid's prompt, or the install and
        // commit) other than reapplying the generator over its own changes.
        if (step.generatorCompleted === true) {
          return commit(state, index, rearm(step, true));
        }
        return {
          kind: 'error',
          reason: `Cannot apply action 'retry' to step '${step.id}': the worker died before recording that its generator ran, so keeping the current tree could apply the migration twice. Use 'retry-clean' or 'adopt' instead.`,
        };
      case 'retry-clean':
        return commit(state, index, cleanRearm(state, step));
      case 'adopt':
        return commit(state, index, {
          ...step,
          status: 'succeeded',
          outcome: { ...step.outcome, summary: adoptedSummary(step) },
        });
    }
  }
  return {
    kind: 'error',
    reason: `Cannot apply action '${action}' to step '${step.id}' in status '${step.status}'.`,
  };
}

// Re-arms for a retry that resets the tree first. The reset target predates
// the generator unless a commit of this step's own already carries it, so the
// marker only survives when such a commit exists; otherwise the reset discards
// the generator's changes and the retry has to run it again.
function cleanRearm(state: MigrateRunState, step: MigrateStep): MigrateStep {
  return rearm(step, coveringLandedEntries(state, step.id).length > 0);
}

// An adopted death records how far the worker got, since 'succeeded' alone
// says the migration was applied and cannot say by what.
function adoptedSummary(step: MigrateStep): string {
  return step.generatorCompleted === true
    ? "Adopted after the worker died: its generator had run, and the working tree it left was taken as this migration's result."
    : "Adopted after the worker died before recording that its generator had run; the working tree it left was taken as this migration's result.";
}

// Re-arms a step for a fresh attempt. Drops every field the previous attempt
// wrote (pid, timestamps, git ref, tree state, outcomes) so a later success
// can't carry a stale failure outcome; dispenseCount stays cumulative across
// attempts.
// `keepGeneratorCompleted` says whether the generator's changes reach the new
// attempt. They do when nothing resets the tree, and when the reset target
// already contains the commit that landed them; re-running the generator there
// would apply them twice. They do not when the reset discards them, and
// keeping the marker then would skip the generator and record a success for a
// migration that never ran. The dependency baseline always survives: it tracks
// the last dependencies that were installed, so dropping it here would leave
// the retry with nothing to detect the previous attempt's package.json edits.
function rearm(
  step: MigrateStep,
  keepGeneratorCompleted: boolean
): MigrateStep {
  return {
    id: step.id,
    roundIndex: step.roundIndex,
    migrationId: step.migrationId,
    status: 'pending',
    attempt: step.attempt + 1,
    dispenseCount: step.dispenseCount,
    ...(step.depsHashAtDispense !== undefined
      ? { depsHashAtDispense: step.depsHashAtDispense }
      : {}),
    ...(keepGeneratorCompleted && step.generatorCompleted
      ? { generatorCompleted: true }
      : {}),
  };
}

// A guarded transition whose observation was made against an earlier attempt
// of the same step: the status recurred, so the observation says nothing about
// the attempt on disk now.
function staleAttempt(
  step: MigrateStep,
  eventType: StepEvent['type'],
  observedAttempt: number
): ApplyStepEventResult {
  return {
    kind: 'error',
    reason: `Cannot apply '${eventType}' to step '${step.id}': it was observed on attempt ${observedAttempt} and the step is now on attempt ${step.attempt}.`,
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

/**
 * Records that the run could not install the dependency changes a step left
 * behind. Not a {@link StepEvent}: it annotates a step instead of moving it,
 * and every status can carry it, since the orchestrator marks a step it has
 * just settled while the worker marks one it is about to fail.
 */
export function markInstallFailed(
  state: MigrateRunState,
  stepId: string
): MigrateRunState {
  return {
    ...state,
    steps: state.steps.map((s) =>
      s.id === stepId ? { ...s, installFailed: true } : s
    ),
  };
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

// Maps absorbed step ids to `{package, name}` for the commit body; an id with
// no matching step, or one whose migration id carries no package, can't be
// attributed there.
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
      };
    case 'failed':
      return { kind: 'failed', stepIds: [stepId] };
    case 'no-changes':
    case 'disabled':
      return null;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
