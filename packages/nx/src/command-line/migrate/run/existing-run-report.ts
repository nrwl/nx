// The facts an init reports when it finds a run already active, so the user
// (or the agent relaying to them) can choose between continuing the run and
// starting fresh. Facts only: nothing here decides, and anything that could
// not be established says so instead of guessing.

import {
  getAncestorStatus,
  getGitCurrentBranch,
  getLatestCommitSha,
  type AncestorStatus,
} from '../../../utils/git-utils';
import { formatAge, singleLine } from '../text';
import {
  findActiveRun,
  NewerRunStateFormatError,
  type MigrateRunPolicy,
  type MigrateRunState,
} from './run-state';
import { unresolvedIssues } from './issues';
import { tallySteps, type StepTally } from './state-machine';
import { isPidAlive, runMigrationsFlag } from './util';

// The stalled count is a subset of `remaining`, called out separately: the
// count alone would read as work that has not been reached yet. Adopted and
// unresolved appear only when present, so the common line stays short.
export function progressLine(tally: StepTally): string {
  return `${tally.applied} applied, ${
    tally.adopted > 0 ? `${tally.adopted} adopted, ` : ''
  }${tally.skipped} skipped, ${
    tally.unresolved.length > 0 ? `${tally.unresolved.length} unresolved, ` : ''
  }${tally.remaining} remaining${
    tally.stalled > 0 ? ` (${tally.stalled} awaiting a decision)` : ''
  }`;
}

export interface ExistingRunFacts {
  runId: string;
  createdAt: string;
  recordedBranch: string | undefined;
  currentBranch: string | null;
  progress: StepTally;
  // Reported problems nobody has fixed yet; a run completing with any of them
  // exits 1, so the count matters to the continue-or-restart decision.
  unresolvedIssues: number;
  // The recorded commit and install policy; a continue runs under it.
  policy: MigrateRunPolicy;
  commits: {
    recorded: number;
    reachable: number;
    unchecked: number;
    newest: { sha: string; status: AncestorStatus } | null;
  };
  liveWorkers: { pid: number; stepId: string; migrationId: string }[];
  // 'unknown' when a run from a newer nx sits on disk: whether it is active
  // cannot be read here, and a reconcile must not fail over a sibling run.
  otherActiveRuns: string[] | 'unknown';
  // Applied migrations the incoming plan lists again; undefined when the
  // caller has no plan (a reconcile).
  appliedStillPlanned: number | undefined;
}

export function collectExistingRunFacts(
  root: string,
  runId: string,
  state: MigrateRunState,
  plannedMigrationIds?: readonly string[]
): ExistingRunFacts {
  const head = getLatestCommitSha(root);
  // Only entries that carry a sha can be located; a failed commit has none,
  // and a landed one may have lost its sha to a transient rev-parse failure.
  const shas = recordedShas(state);
  const statuses = shas.map((sha) =>
    head ? getAncestorStatus(sha, head, root) : ('unknown' as const)
  );
  const newestIndex = shas.length - 1;
  const planned = plannedMigrationIds ? new Set(plannedMigrationIds) : null;
  return {
    runId,
    createdAt: state.createdAt,
    recordedBranch: state.branch,
    currentBranch: getGitCurrentBranch(root),
    progress: tallySteps(state),
    unresolvedIssues: unresolvedIssues(state).length,
    policy: {
      createCommits: state.createCommits,
      skipInstall: state.skipInstall === true,
    },
    commits: {
      recorded: shas.length,
      reachable: statuses.filter((s) => s === 'ancestor').length,
      unchecked: statuses.filter((s) => s === 'unknown').length,
      newest:
        newestIndex >= 0
          ? { sha: shas[newestIndex], status: statuses[newestIndex] }
          : null,
    },
    // Only a step recorded as running can own a worker; a died or finished
    // step's pid may have been reused by an unrelated process since.
    liveWorkers: state.steps
      .filter((s) => s.status === 'running' && s.pid !== undefined)
      .filter((s) => isPidAlive(s.pid))
      .map((s) => ({ pid: s.pid, stepId: s.id, migrationId: s.migrationId })),
    otherActiveRuns: otherActiveRuns(root, runId),
    appliedStillPlanned: planned
      ? state.steps.filter(
          (s) => s.status === 'succeeded' && planned.has(s.migrationId)
        ).length
      : undefined,
  };
}

export function recordedShas(state: MigrateRunState): string[] {
  return state.commits.flatMap((entry) => (entry.sha ? [entry.sha] : []));
}

function otherActiveRuns(root: string, runId: string): string[] | 'unknown' {
  try {
    return findActiveRun(root).activeRunIds.filter((id) => id !== runId);
  } catch (e) {
    if (e instanceof NewerRunStateFormatError) {
      return 'unknown';
    }
    throw e;
  }
}

export interface ExistingRunCommands {
  continueCommand: string;
  // A path that cannot be rendered as executable text for this shell is named
  // in prose instead of a command (see runMigrationsFlag).
  startFresh: { command: string } | { migrationsPath: string };
}

export function renderStartFresh(
  migrationsPath: string | undefined,
  command: (runMigrationsFlag: string) => string
): ExistingRunCommands['startFresh'] {
  if (migrationsPath === undefined) {
    return { command: command('--run-migrations') };
  }
  const flag = runMigrationsFlag(migrationsPath);
  return flag === null ? { migrationsPath } : { command: command(flag) };
}

/**
 * Title plus body lines, in the shape the agent-output writers take. Every
 * body line goes through `singleLine`: branch names and timestamps came from
 * git and disk, and the lines end up on the stdout the agent scans for
 * blocks. The title carries only the run id, which discovery validated.
 */
export function renderExistingRunReport(
  facts: ExistingRunFacts,
  commands?: ExistingRunCommands
): { title: string; bodyLines: string[] } {
  const lines = [
    `  run: ${facts.runId}`,
    `  started: ${facts.createdAt} (${formatAge(facts.createdAt)})`,
    `  branch: ${branchLine(facts)}`,
    `  progress: ${progressLine(facts.progress)}`,
    `  policy: per-migration commits ${facts.policy.createCommits ? 'on' : 'off'}, installs ${facts.policy.skipInstall ? 'skipped' : 'on'}`,
    `  commits: ${commitsLine(facts.commits)}`,
    `  worker: ${workersLine(facts.liveWorkers)}`,
  ];
  if (facts.unresolvedIssues > 0) {
    lines.push(`  issues: ${facts.unresolvedIssues} unresolved`);
  }
  if (facts.otherActiveRuns === 'unknown') {
    lines.push(
      `  other active runs on disk: unknown (a run written by a newer nx is on disk)`
    );
  } else if (facts.otherActiveRuns.length > 0) {
    lines.push(
      `  other active runs on disk: ${facts.otherActiveRuns.join(', ')}`
    );
  }
  if (facts.appliedStillPlanned !== undefined) {
    lines.push(
      `  plan overlap: ${facts.appliedStillPlanned} of the applied migrations ${
        facts.appliedStillPlanned === 1 ? 'is' : 'are'
      } still in the plan; a new run applies ${
        facts.appliedStillPlanned === 1 ? 'it' : 'them'
      } again`
    );
  }
  if (commands) {
    lines.push(
      ``,
      `To continue the run: ${commands.continueCommand}`,
      `To start fresh (deletes the run record, then runs the whole plan again): ${
        'command' in commands.startFresh
          ? commands.startFresh.command
          : `re-run this nx migrate command with --start-fresh, passing the migrations file this run was started from (${commands.startFresh.migrationsPath}) to --run-migrations; that path cannot be rendered as a command for this shell`
      }`
    );
  }
  return {
    title: `A migrate run is already active: ${facts.runId}`,
    bodyLines: lines.map(singleLine),
  };
}

// A null probe is 'unknown' on both sides: getGitCurrentBranch folds a
// detached HEAD and a failed git call into one null.
function branchLine(facts: ExistingRunFacts): string {
  const recorded = facts.recordedBranch ?? 'unknown';
  const current = facts.currentBranch ?? 'unknown';
  return recorded === current
    ? recorded
    : `started on ${recorded}, currently on ${current}`;
}

function commitsLine(commits: ExistingRunFacts['commits']): string {
  if (!commits.newest) {
    return 'none recorded';
  }
  const newest = `newest recorded commit ${commits.newest.sha.slice(0, 10)} is ${describeStatus(
    commits.newest.status
  )}`;
  const tally = `${commits.reachable} of ${commits.recorded} reachable${
    commits.unchecked > 0 ? `, ${commits.unchecked} could not be checked` : ''
  }`;
  return `${newest} (${tally})`;
}

function describeStatus(status: AncestorStatus): string {
  switch (status) {
    case 'ancestor':
      return 'reachable from HEAD';
    case 'not-ancestor':
      return 'not reachable from HEAD';
    case 'unknown':
      return 'of unknown reachability from HEAD';
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled ancestor status '${exhaustive}'.`);
    }
  }
}

function workersLine(workers: ExistingRunFacts['liveWorkers']): string {
  if (workers.length === 0) {
    return 'none running';
  }
  return workers
    .map((w) => `pid ${w.pid} is still running ${w.stepId} (${w.migrationId})`)
    .join('; ');
}
