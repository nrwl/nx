// Giving a step up while the run commits is one operation under one tree
// reservation, run by the process that holds the tree (a session's parent or
// the reconcile): split across two, the transition would find the give-up's
// own commit in the ledger and refuse it as a commit of the migration.

import {
  commitMigrationIfRequested,
  type CommitResult,
} from '../migrate-commits';
import type { MigrateOutputSink } from '../deferred-output';
import { warnToAgent } from './agent-output';
import type { TreeLease } from './broker';
import {
  archiveIssues,
  attachIssueIdsToCommitEntry,
  mintUnresolvedIssue,
} from './issues';
import {
  readRunState,
  type MigrateCommitLedgerEntry,
  type MigrateRunState,
  type MigrateStep,
} from './run-state';
import { updateRunState } from './state-lock';
import {
  appendCommit,
  applyStepEvent,
  clearCommitStarted,
  commitNameForStep,
  commitResultToLedgerEntry,
  gitRan,
  markCommitStarted,
  markInstallFailed,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
} from './state-machine';
import {
  installDepsChangedSinceDispense,
  summarizeError,
  warnCommitFailed,
} from './util';

export type GiveUpOutcome =
  | {
      kind: 'given-up';
      // The commit's result, or the dependency install that threw before it;
      // the step then carries the failed debt and its install failure.
      commit: CommitResult | { status: 'install-failed'; reason: string };
      // The issue is in the ledger; only its archive file is missing.
      archiveError?: string;
    }
  | { kind: 'refused'; reason: string };

export interface GiveUpInput {
  root: string;
  dir: string;
  step: MigrateStep;
  // Held by the caller for the step's give-up seam. The mark it set is
  // cleared by the settling write; once git may have run, a write that fails
  // leaves it standing, and the release must not clear it either.
  lease: TreeLease;
  skipInstall: boolean;
  reconcileCommand: string;
  output?: MigrateOutputSink;
}

export async function giveUpWithCommit(
  input: GiveUpInput
): Promise<GiveUpOutcome> {
  const { root, dir, step, lease } = input;
  const ownMark = lease.markedStepId === step.id;
  const event = {
    type: 'stepAction',
    stepId: step.id,
    action: 'unresolved',
    attempt: step.attempt,
  } as const;
  const state = readRunState(dir);
  // Checked under the reservation, before git runs: a landed commit of the
  // step, or a mark another operation left, refuses the give-up with nothing
  // to undo. The mark this reservation set is not evidence against it.
  const accepted = applyStepEvent(
    ownMark ? clearCommitStarted(state, step.id) : state,
    event
  );
  if (accepted.kind === 'error') {
    return { kind: 'refused', reason: accepted.reason };
  }
  const absorbedStepIds = uncoveredFailedStepIds(state).filter(
    (id) => id !== step.id
  );
  let commit: Extract<GiveUpOutcome, { kind: 'given-up' }>['commit'];
  let entry: MigrateCommitLedgerEntry | null;
  try {
    const result = await commitMigrationIfRequested(
      root,
      { name: commitNameForStep(step, 'unresolved') },
      true,
      state.commitPrefix,
      () =>
        installDepsChangedSinceDispense(
          root,
          dir,
          step,
          input.skipInstall,
          input.reconcileCommand,
          input.output
        ),
      stepsToPendingMigrations(state, absorbedStepIds),
      undefined,
      input.output
    );
    commit = result;
    entry = commitResultToLedgerEntry(result, step.id, absorbedStepIds);
  } catch (e) {
    // The install is the only thrower: the commit reports through its result.
    // The debt cannot stand in for the install failure, since a later commit
    // absorbing this diff clears the debt while the dependencies are still
    // missing.
    commit = { status: 'install-failed', reason: summarizeError(e) };
    entry = { kind: 'failed', stepIds: [step.id] };
  }
  const ran = commit.status !== 'install-failed' && gitRan(commit);
  if (ran) lease.markedStepId = undefined;
  let archiveError: string | undefined;
  let refusal: string | undefined;
  updateRunState(dir, (fresh) => {
    // Re-applied on fresh state. The reservation kept every other commit of
    // the step out, so only run state edited from outside can refuse it now;
    // the commit then stays unrecorded, with the mark standing for an adopt.
    const applied = applyStepEvent(
      ownMark ? clearCommitStarted(fresh, step.id) : fresh,
      event
    );
    if (applied.kind === 'error') {
      refusal = applied.reason;
      return null;
    }
    // A failure once git ran keeps the mark: only a landed entry accounts
    // for the commit it may have made.
    const recorded = recordUnresolvedIssue(
      dir,
      ownMark && commit.status === 'failed'
        ? markCommitStarted(applied.state, step.id)
        : applied.state,
      step.id
    );
    archiveError = recorded.archiveError;
    let next =
      commit.status === 'install-failed'
        ? markInstallFailed(recorded.state, step.id)
        : recorded.state;
    if (entry) {
      const index = next.commits.length;
      next = appendCommit(next, attachIssueIdsToCommitEntry(next, entry));
      next = {
        ...next,
        steps: next.steps.map((s) =>
          s.id === step.id ? { ...s, commitLedgerIndex: index } : s
        ),
      };
    }
    return next;
  });
  if (refusal !== undefined) {
    return {
      kind: 'refused',
      reason:
        entry?.kind === 'landed' && entry.sha
          ? `${refusal} Note: this action's commit ${entry.sha} had already landed and stays in history; resolve the step against the tree as it stands now.`
          : refusal,
    };
  }
  return {
    kind: 'given-up',
    commit,
    ...(archiveError !== undefined ? { archiveError } : {}),
  };
}

/**
 * Mints the issue that carries a given-up step's failure and points the step
 * at it, on state where the step is already unresolved. The archive file is
 * best-effort: run.json is authoritative, and undoing the transition for a
 * lost detail file would make the agent re-issue an action the run already
 * took.
 */
export function recordUnresolvedIssue(
  dir: string,
  state: MigrateRunState,
  stepId: string
): { state: MigrateRunState; archiveError?: string } {
  // Minted from the transitioned step: a died one only gains its failure in
  // the transition.
  const minted = mintUnresolvedIssue(
    state,
    state.steps.find((s) => s.id === stepId)
  );
  let archiveError: string | undefined;
  try {
    archiveIssues(dir, minted.application);
  } catch (e) {
    archiveError = summarizeError(e);
  }
  return {
    state: {
      ...minted.application.state,
      steps: minted.application.state.steps.map((s) =>
        s.id === stepId ? { ...s, unresolvedIssueId: minted.issueId } : s
      ),
    },
    ...(archiveError !== undefined ? { archiveError } : {}),
  };
}

export function warnUnresolvedNotArchived(
  migrationId: string,
  archiveError: string
): void {
  warnToAgent({
    title: `The issue recording that ${migrationId} was left unresolved could not be archived (${archiveError}).`,
    bodyLines: [
      `run.json stays authoritative: the step is unresolved and the issue is in its ledger; only the archived file under the run's issues directory is missing.`,
    ],
  });
}

/** What the reconcile owes the agent for a give-up that went through. */
export function warnAboutGiveUp(
  step: MigrateStep,
  outcome: Extract<GiveUpOutcome, { kind: 'given-up' }>
): void {
  const name = commitNameForStep(step, 'unresolved');
  switch (outcome.commit.status) {
    case 'install-failed':
      warnCommitFailed(name, outcome.commit.reason);
      break;
    case 'failed':
      warnCommitFailed(name);
      break;
    case 'committed':
    case 'no-changes':
    case 'disabled':
      break;
    default: {
      const exhaustive: never = outcome.commit;
      throw new Error(`Unhandled commit result: ${JSON.stringify(exhaustive)}`);
    }
  }
  if (outcome.archiveError !== undefined) {
    warnUnresolvedNotArchived(step.migrationId, outcome.archiveError);
  }
}
