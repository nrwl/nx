import {
  getLatestCommitSha,
  isAncestorCommit,
  resetWorkingTree,
} from '../../../utils/git-utils';
import { MIGRATE_RUNS_RELATIVE_DIR } from '../agentic/types';
import { warnToAgent } from './agent-output';
import {
  archiveIssues,
  reopenResolutionsForStep,
  warnReconstructedArchives,
  type IssueArchiveUpdate,
} from './issues';
import type {
  MigrateCommitLedgerEntry,
  MigrateRunState,
  MigrateStep,
} from './run-state';
import { updateRunState } from './state-lock';
import {
  coveringLandedEntries,
  discardGeneratorRun,
  hasPendingCommitDebt,
  stepLabel,
  stepNoun,
} from './state-machine';
import { summarizeError } from './util';

// A clean retry resets the tree to the step's `gitRefBefore`, discarding
// everything the ref does not account for. It is offered only when it does
// account for the whole tree: every prior diff committed, the tree clean when
// the step was dispensed, and HEAD still at the ref. An absent or unreadable
// value is no restore point, never a clean one. The debt check is run-wide:
// the reset discards every step's uncommitted work, not only this one's.
export function canOfferCleanRetry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): boolean {
  return (
    state.createCommits &&
    !state.checkpointFailed &&
    !hasPendingCommitDebt(state) &&
    !!step.gitRefBefore &&
    head === step.gitRefBefore &&
    step.treeCleanAtDispense === true &&
    !endangeredLandedEntry(root, state, step)
  );
}

// The last landed entry covering the step whose commit a reset to the step's
// `gitRefBefore` would discard: one that is not a verified ancestor of it.
function endangeredLandedEntry(
  root: string,
  state: MigrateRunState,
  step: MigrateStep
): MigrateCommitLedgerEntry | null {
  let endangered: MigrateCommitLedgerEntry | null = null;
  for (const entry of coveringLandedEntries(state, step.id)) {
    if (
      !entry.sha ||
      !step.gitRefBefore ||
      !isAncestorCommit(entry.sha, step.gitRefBefore, root)
    ) {
      endangered = entry;
    }
  }
  return endangered;
}

export function cleanRetryUnavailableReason(
  root: string,
  state: MigrateRunState,
  step: MigrateStep,
  head: string | null
): string {
  const endangered = endangeredLandedEntry(root, state, step);
  const noun = stepNoun(step);
  if (endangered) {
    return endangered.sha
      ? `this ${noun}'s changes already landed in commit ${endangered.sha}, which a reset would discard.`
      : `this ${noun}'s changes already landed in a commit, which a reset would discard.`;
  }
  if (step.gitRefBefore && head !== step.gitRefBefore) {
    return `HEAD is at ${head ?? '(unreadable)'} rather than the ${
      step.gitRefBefore
    } this ${noun} started from, so a reset would discard what was committed in between.`;
  }
  return `resetting the tree could discard uncommitted work that no restore point accounts for.`;
}

// Best-effort: run.json records the reverted dispositions and stays
// authoritative, so a failed append loses only the archive's trail record of
// the revert.
function archiveReopenedResolutions(
  dir: string,
  state: MigrateRunState,
  updates: IssueArchiveUpdate[],
  label: string
): void {
  if (updates.length === 0) return;
  const reconstructedIds: string[] = [];
  try {
    archiveIssues(dir, { state, newIssues: [], updates }, reconstructedIds);
  } catch (e) {
    warnToAgent({
      title: `The reverted issue resolutions for ${label} could not be archived (${summarizeError(e)}).`,
      bodyLines: [
        `run.json stays authoritative for the dispositions; the archived files under the run's issues directory miss the revert records, so their last entries may still read resolved.`,
      ],
    });
  }
  warnReconstructedArchives(reconstructedIds);
}

/**
 * The reset a clean retry of `stepId` needs, run with the tree reserved. The
 * retry is re-checked against the state read then, and the attempt's
 * generator run and the fixes its resolutions claimed are forgotten in a
 * write of their own before git runs, so a reset that fails midway leaves
 * the plain retry gated. Throws the reason when the retry is no longer
 * available, or what git said when the reset fails.
 */
export function resetForCleanRetry(
  root: string,
  dir: string,
  stepId: string
): void {
  const head = getLatestCommitSha(root);
  let step: MigrateStep | undefined;
  let updates: IssueArchiveUpdate[] = [];
  const prepared = updateRunState(dir, (fresh) => {
    step = fresh.steps.find((s) => s.id === stepId);
    if (!step) throw new Error(`step '${stepId}' is not in the run.`);
    if (!canOfferCleanRetry(root, fresh, step, head)) {
      throw new Error(cleanRetryUnavailableReason(root, fresh, step, head));
    }
    const reopened = reopenResolutionsForStep(
      discardGeneratorRun(fresh, stepId),
      stepId
    );
    updates = reopened.updates;
    return reopened.state;
  });
  archiveReopenedResolutions(dir, prepared, updates, stepLabel(step));
  resetWorkingTree(step.gitRefBefore, [MIGRATE_RUNS_RELATIVE_DIR], root);
}
