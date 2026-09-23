// A master session's agent runs the dispensed `nx migrate` commands inside
// its own sandbox, where a dependency install has no network and a commit
// cannot write `.git`. The parent nx that spawned the session advertises
// itself through NX_MIGRATE_BROKER, and a step then hands its install, and
// its commit when one is due, over a request/result file pair under
// <runDir>/broker/ instead of running them itself. Nothing here authorizes:
// every file the parent could consult is writable from the sandbox, so the
// parent's own invocation decides what it installs and commits.

import { randomBytes } from 'crypto';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { FileLock, IS_WASM } from '../../../native';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import { parseJson } from '../../../utils/json';
import {
  ensureRunSubdir,
  handoffsDirState,
  readAtomicallyPublishedFile,
} from '../agentic/handoff';
import {
  DeferredOutputCollector,
  replayDeferredOutput,
  type DeferredOutputRecord,
} from '../deferred-output';
import { NpmPeerDepsInstallError } from '../execute-migration';
import {
  commitMigrationIfRequested,
  type CommitResult,
} from '../migrate-commits';
import { publishFileAtomically } from './atomic-write';
import { giveUpWithCommit, type GiveUpOutcome } from './give-up';
import {
  readRunState,
  type MigrateRunPolicy,
  type MigrateRunState,
  type MigrateStep,
  type MigrateStepStatus,
  type MigrateTreeOperation,
} from './run-state';
import { updateRunState } from './state-lock';
import {
  appendCommit,
  clearCommitStarted,
  commitNameForStep,
  commitResultToLedgerEntry,
  gitRan,
  markCommitStarted,
  markInstallFailed,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
} from './state-machine';
import { attachIssueIdsToCommitEntry } from './issues';
import { resetForCleanRetry } from './clean-retry';
import { installDepsChangedSinceDispense, isPidAlive } from './util';

export const BROKER_ENV_VAR = 'NX_MIGRATE_BROKER';
const BROKER_DIR_NAME = 'broker';
const CHILD_POLL_INTERVAL_MS = 250;

// Repeated requests reuse the first answer; a reset asks anew (see
// `invocation`). A died step's adopt shares the worker's commit request until
// that commit is recorded; later adopts and a failed step's actions ask under
// their own request id.
export type BrokerRequestKind =
  | 'commit'
  // A worker's install: after its generator, or a retry's from the baseline.
  | 'install'
  // The fold's install when it commits nothing, a retained tree included.
  | 'fold-install'
  // The install a skip or a non-commit adopt owes for the tree it keeps.
  | 'action-install'
  // A clean retry's reset of the tree to the step's starting ref.
  | 'reset'
  // A give-up's commit of the partial tree and the transition it settles,
  // as one operation (see give-up.ts).
  | 'give-up';

export type InstallSeam = 'install' | 'fold-install' | 'action-install';

export interface BrokerRequest {
  kind: BrokerRequestKind;
  stepId: string;
  attempt: number;
  // Reset only: a fresh id per clean retry, so a second retry of the same
  // attempt resets again instead of reading the first reset's answer.
  invocation?: string;
  // The parent owns commit policy; this only tells a failed step's adopt
  // commit apart from the worker's request.
  commitAs?: 'adopt';
}

export type BrokerResult =
  | {
      kind: 'commit';
      result: CommitResult;
      absorbedStepIds: string[];
      output: DeferredOutputRecord[];
    }
  | { kind: 'installed'; output: DeferredOutputRecord[] }
  | {
      kind: 'install-failed';
      message: string;
      peerDeps: boolean;
      output: DeferredOutputRecord[];
    }
  | { kind: 'reset'; error?: string }
  | { kind: 'give-up'; outcome: GiveUpOutcome; output: DeferredOutputRecord[] }
  | { kind: 'stale' };

type BrokerAnswer = Extract<
  BrokerResult,
  { kind: 'commit' | 'installed' | 'reset' | 'give-up' }
>;

export interface BrokeredCommit {
  result: CommitResult;
  absorbedStepIds: string[];
  /**
   * True when the session's parent ran the commit and recorded whatever it
   * produced before answering, so the caller appends nothing. False for an
   * in-process commit, which the caller records.
   */
  recorded: boolean;
}

/** The request no longer matches the step: another attempt owns it. */
export class BrokerStaleRequestError extends Error {}

/**
 * The advertised parent could not accept the request, or went away before
 * answering it. It may have landed the install or the commit; the tree and
 * the run state say.
 */
export class BrokerUnavailableError extends Error {}

/** Another live process holds the working tree for an operation of its own. */
export class TreeBusyError extends Error {}

// A reservation names a step's seam, or the checkpoint's run-level one.
export interface TreeOperationRequest {
  kind: BrokerRequestKind | 'checkpoint';
  stepId?: string;
  attempt?: number;
}

export interface TreeLease {
  readonly owner: string;
  // The step this operation marked as having a commit under way, if any.
  // Unset by the seam once git ran, so the release leaves the mark standing:
  // only a landed ledger entry can account for a commit that may be in history.
  markedStepId?: string;
  release(): void;
}

/**
 * Owned by the scope that runs an operation and its state write: a seam that
 * acquires in process writes the lease here before its fallible callback
 * runs, and the scope releases it in a `finally` once the write landed or
 * failed. A brokered call leaves it empty; the parent holds its own.
 */
export interface TreeScope {
  lease?: TreeLease;
}

/**
 * Reserves the working tree for one operation in a single fresh-state write:
 * the request must still be at its seam (else the attempt moved on and the
 * request is stale), and no other live process may hold a reservation.
 * A reservation whose owner process is gone holds nothing.
 */
export function acquireTreeOperation(
  dir: string,
  request: TreeOperationRequest,
  owner: string = randomBytes(4).toString('hex')
): TreeLease {
  // A commit marks its step as started; a mark already there belongs to an
  // operation whose outcome is still unknown, and this one leaves it.
  let marks = false;
  updateRunState(dir, (fresh) => {
    if (!atSeam(fresh, request)) {
      throw new BrokerStaleRequestError(
        `The request for this step no longer matches its attempt; nothing was installed or committed.`
      );
    }
    const held = liveTreeOperation(fresh, owner);
    if (held) throw new TreeBusyError(treeBusyMessage(held));
    marks =
      (request.kind === 'commit' || request.kind === 'give-up') &&
      fresh.steps.find((s) => s.id === request.stepId)?.commitStarted !== true;
    return {
      ...(marks ? markCommitStarted(fresh, request.stepId) : fresh),
      treeOperation: {
        kind: request.kind,
        ...(request.stepId !== undefined ? { stepId: request.stepId } : {}),
        ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
        owner,
        pid: process.pid,
      },
    };
  });
  const lease: TreeLease = {
    owner,
    ...(marks ? { markedStepId: request.stepId } : {}),
    release: () => releaseTreeOperation(dir, owner, lease.markedStepId),
  };
  return lease;
}

/**
 * Owner-checked: a lease released late never drops a newer reservation, nor
 * the mark it set.
 */
export function releaseTreeOperation(
  dir: string,
  owner: string,
  markedStepId?: string
): void {
  updateRunState(dir, (fresh) => {
    if (fresh.treeOperation?.owner !== owner) return null;
    const released = { ...fresh, treeOperation: undefined };
    return markedStepId ? clearCommitStarted(released, markedStepId) : released;
  });
}

/** The reservation a live process other than `owner` holds, if any. */
export function liveTreeOperation(
  state: MigrateRunState,
  owner?: string
): MigrateTreeOperation | undefined {
  const held = state.treeOperation;
  if (!held || held.owner === owner || !isPidAlive(held.pid)) return undefined;
  return held;
}

export function treeBusyMessage(held: MigrateTreeOperation): string {
  return `The working tree is held by process ${held.pid} for ${treeOperationLabel(
    held
  )}; run the reconcile again once it finishes.`;
}

export function treeOperationLabel(
  held: Pick<MigrateTreeOperation, 'kind' | 'stepId'>
): string {
  switch (held.kind) {
    case 'checkpoint':
      return 'the checkpoint commit';
    case 'commit':
    case 'give-up':
      return `the commit of step '${held.stepId}'`;
    case 'reset':
      return `the reset of step '${held.stepId}'`;
    case 'install':
    case 'fold-install':
    case 'action-install':
      return `the install of step '${held.stepId}'`;
    default: {
      const exhaustive: never = held.kind;
      throw new Error(`Unhandled tree operation '${exhaustive}'.`);
    }
  }
}

function atSeam(
  state: MigrateRunState,
  request: TreeOperationRequest
): boolean {
  if (request.kind === 'checkpoint') {
    return (
      state.createCommits &&
      state.checkpointFailed === true &&
      state.steps.every((s) => s.status === 'pending')
    );
  }
  return (
    Object.hasOwn(SEAM_STATUSES, request.kind) &&
    request.stepId !== undefined &&
    request.attempt !== undefined &&
    isAtSeam(
      state.steps.find((s) => s.id === request.stepId),
      request as BrokerRequest
    )
  );
}

const SEAM_STATUSES: Record<
  BrokerRequestKind,
  ReadonlySet<MigrateStepStatus>
> = {
  commit: new Set(['running', 'awaiting-prompt-outcome', 'failed', 'died']),
  install: new Set(['running']),
  'fold-install': new Set(['awaiting-prompt-outcome']),
  'action-install': new Set(['failed', 'died']),
  reset: new Set(['failed', 'died']),
  'give-up': new Set(['failed', 'died']),
};

function isAtSeam(
  step: MigrateStep | undefined,
  request: BrokerRequest
): boolean {
  return (
    step !== undefined &&
    step.attempt === request.attempt &&
    SEAM_STATUSES[request.kind].has(step.status)
  );
}

export function brokerDir(runDirPath: string): string {
  return join(runDirPath, BROKER_DIR_NAME);
}

function lockPath(runDirPath: string, nonce: string): string {
  return join(brokerDir(runDirPath), `${nonce}.lock`);
}

function requestPath(runDirPath: string, id: string): string {
  return join(brokerDir(runDirPath), `${id}.request.json`);
}

function resultPath(runDirPath: string, id: string): string {
  return join(brokerDir(runDirPath), `${id}.result.json`);
}

// A request file lives in the agent-writable broker directory, so it could be
// a planted symlink or FIFO; read it without reading a symlink's target or
// blocking on a FIFO.
function readRequestFile(filePath: string): BrokerRequest {
  return parseJson<BrokerRequest>(
    readAtomicallyPublishedFile(filePath, `${filePath} is not a regular file.`)
  );
}

/**
 * Runs the step's install and commit where they can land: in this process
 * unless a parent session advertised its broker, in which case the request
 * goes to the parent and the answer comes back with the output the parent
 * collected, printed here. The absorbed step ids come from whichever side
 * ran the commit, so the ledger entry names what its `git add -A` took.
 */
export async function commitStepTree(
  dir: string,
  step: MigrateStep,
  absorbedStepIds: string[],
  commitInProcess: () => Promise<CommitResult>,
  scope: TreeScope,
  commitAs?: 'adopt'
): Promise<BrokeredCommit> {
  const request: BrokerRequest = {
    kind: 'commit',
    stepId: step.id,
    attempt: step.attempt,
    ...(commitAs !== undefined ? { commitAs } : {}),
  };
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    const lease = acquireTreeOperation(dir, request);
    scope.lease = lease;
    const result = await commitInProcess();
    if (gitRan(result)) lease.markedStepId = undefined;
    return { result, absorbedStepIds, recorded: false };
  }
  const answer = await ask(dir, nonce, request);
  if (answer.kind !== 'commit') {
    throw new Error(`Unexpected '${answer.kind}' answer to a commit request.`);
  }
  return {
    result: answer.result,
    absorbedStepIds: answer.absorbedStepIds,
    recorded: true,
  };
}

/**
 * The same for a step that owes only its install: no commit is due, or the
 * commit waits for a fold.
 */
export async function installStepTree(
  dir: string,
  step: MigrateStep,
  seam: InstallSeam,
  installInProcess: () => Promise<void>,
  scope: TreeScope
): Promise<void> {
  const request: BrokerRequest = {
    kind: seam,
    stepId: step.id,
    attempt: step.attempt,
  };
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    scope.lease = acquireTreeOperation(dir, request);
    return installInProcess();
  }
  const answer = await ask(dir, nonce, request);
  if (answer.kind !== 'installed') {
    throw new Error(
      `Unexpected '${answer.kind}' answer to an install request.`
    );
  }
}

/**
 * The same for the reset a clean retry of a failed or died step needs. Runs
 * `resetInProcess` under the reservation, or asks the parent, which resets
 * against the state it reads then; a reset that could not run throws.
 */
export async function resetStepTree(
  dir: string,
  step: MigrateStep,
  resetInProcess: () => void,
  scope: TreeScope
): Promise<void> {
  const request: BrokerRequest = {
    kind: 'reset',
    stepId: step.id,
    attempt: step.attempt,
    invocation: randomBytes(4).toString('hex'),
  };
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    scope.lease = acquireTreeOperation(dir, request);
    return resetInProcess();
  }
  const answer = await ask(dir, nonce, request);
  if (answer.kind !== 'reset') {
    throw new Error(`Unexpected '${answer.kind}' answer to a reset request.`);
  }
}

/**
 * The same for giving a failed or died step up while the run commits. Unlike
 * the seams above, the operation settles the step itself, under the
 * reservation it runs with, so the caller writes no transition of its own.
 */
export async function giveUpStepTree(
  root: string,
  dir: string,
  step: MigrateStep,
  skipInstall: boolean,
  reconcileCommand: string,
  scope: TreeScope
): Promise<GiveUpOutcome> {
  const request: BrokerRequest = {
    kind: 'give-up',
    stepId: step.id,
    attempt: step.attempt,
  };
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    const lease = acquireTreeOperation(dir, request);
    scope.lease = lease;
    return giveUpWithCommit({
      root,
      dir,
      step,
      lease,
      skipInstall,
      reconcileCommand,
    });
  }
  const answer = await ask(dir, nonce, request);
  if (answer.kind !== 'give-up') {
    throw new Error(`Unexpected '${answer.kind}' answer to a give-up request.`);
  }
  return answer.outcome;
}

async function ask(
  dir: string,
  nonce: string,
  request: BrokerRequest
): Promise<BrokerAnswer> {
  const id = `${nonce}-${request.stepId}-${request.attempt}-${request.kind}${
    request.invocation ? `-${request.invocation}` : ''
  }${request.commitAs !== undefined ? `-${request.commitAs}` : ''}`;
  const path = resultPath(dir, id);
  // A repeat reads the first answer, whatever became of the session since.
  if (existsSync(path)) {
    return settle(readJsonFile<BrokerResult>(path));
  }
  // No deadline: an install or a commit over a large tree takes as long as it
  // takes; the poll ends with an answer or a released lock. The probe is built
  // first so a request is never left unwatched, and once: each instance holds
  // a descriptor, and `wait()` would pin this process until the session ends.
  let lock: FileLock | null = null;
  try {
    lock = IS_WASM ? null : new FileLock(lockPath(dir, nonce));
  } catch (e) {
    if (existsSync(path)) {
      return settle(readJsonFile<BrokerResult>(path));
    }
    throw notAccepting(e);
  }
  try {
    publishFileAtomically(requestPath(dir, id), (tmpPath) =>
      writeJsonFile(tmpPath, request)
    );
  } catch (e) {
    throw notAccepting(e);
  }
  for (;;) {
    if (existsSync(path)) {
      return settle(readJsonFile<BrokerResult>(path));
    }
    if (lock && lockIsFree(lock)) {
      // Answered and closed between the two checks: the answer stays on disk.
      if (existsSync(path)) continue;
      throw new BrokerUnavailableError(
        `The nx migrate session that started this step ended before its request was answered. The install or the commit may still have landed; check the working tree and git log.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, CHILD_POLL_INTERVAL_MS));
  }
}

function notAccepting(e: unknown): BrokerUnavailableError {
  return new BrokerUnavailableError(
    `The nx migrate session that started this step is not accepting its request (${
      e instanceof Error ? e.message : String(e)
    }).`
  );
}

// A probe that fails says nothing about the parent; keep waiting.
function lockIsFree(lock: FileLock): boolean {
  try {
    return !lock.check();
  } catch {
    return false;
  }
}

function settle(result: BrokerResult): BrokerAnswer {
  switch (result.kind) {
    case 'commit':
    case 'installed':
      replayDeferredOutput(result.output);
      return result;
    case 'install-failed':
      replayDeferredOutput(result.output);
      // The CLI catch returns 1 on the typed error instead of logging again.
      throw result.peerDeps
        ? new NpmPeerDepsInstallError()
        : new Error(result.message);
    case 'reset':
      if (result.error !== undefined) throw new Error(result.error);
      return result;
    case 'give-up':
      replayDeferredOutput(result.output);
      return result;
    case 'stale':
      throw new BrokerStaleRequestError(
        `The request for this step no longer matches its attempt; nothing was installed or committed.`
      );
    default: {
      const exhaustive: never = result;
      throw new Error(`Unhandled broker result: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * The parent side. Holds one exclusive lock for the session's lifetime so a
 * waiting step can tell a slow parent from a dead one, answers each request
 * once, and removes its own requests on close; its answers stay for the steps
 * still reading them. Requests carrying another session's nonce belong to
 * that session and are never touched. Whether to install or commit comes from
 * the policy the session started with, never from run state, which the
 * agent's sandbox can write.
 */
export class MigrateCommitBroker {
  readonly nonce = randomBytes(4).toString('hex');
  private readonly handled = new Set<string>();
  private inFlight: BrokerRequest | null = null;
  // Kept referenced: the lock is released when the instance is collected.
  private readonly lock: FileLock | null;

  constructor(
    private readonly root: string,
    private readonly dir: string,
    private readonly reconcileCommand: string,
    private readonly policy: MigrateRunPolicy
  ) {
    ensureRunSubdir(brokerDir(dir), () => this.notADirectory());
    this.lock = IS_WASM ? null : new FileLock(lockPath(dir, this.nonce));
    this.lock?.lock();
  }

  /** The request whose operation this process is running right now. */
  get requestInFlight(): BrokerRequest | null {
    return this.inFlight;
  }

  /** Answers this session's unanswered requests, one at a time. */
  async service(): Promise<void> {
    // Refused rather than followed: a symlink swapped in would send the reads
    // and the answers wherever it points, or leave requests unanswered.
    if (handoffsDirState(brokerDir(this.dir)) !== 'directory') {
      throw this.notADirectory();
    }
    const prefix = `${this.nonce}-`;
    const suffix = '.request.json';
    for (const name of readdirSync(brokerDir(this.dir))) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const id = name.slice(0, -suffix.length);
      if (this.handled.has(id)) continue;
      const request = readRequestFile(requestPath(this.dir, id));
      // Reserved before anything runs, released after the record is written.
      // A tree held by another live process is left for a later pass, not
      // marked handled; a request no longer at its seam is answered stale.
      let lease: TreeLease | null = null;
      try {
        lease = acquireTreeOperation(this.dir, request, this.nonce);
      } catch (e) {
        if (e instanceof TreeBusyError) continue;
        if (!(e instanceof BrokerStaleRequestError)) throw e;
      }
      this.handled.add(id);
      let result: BrokerResult;
      try {
        if (lease) this.inFlight = request;
        result = lease ? await this.answer(request, lease) : { kind: 'stale' };
        // Recorded by the process that ran the commit, before the answer: the
        // step reading it can die with the commit already in history. A failed
        // record throws and ends the session rather than losing the entry.
        if (result.kind === 'commit') {
          if (gitRan(result.result)) lease.markedStepId = undefined;
          this.record(request, result);
        }
      } finally {
        this.inFlight = null;
        lease?.release();
      }
      // Published after the release, so the step reading the answer never
      // finds this request's reservation still standing over its own write.
      publishFileAtomically(resultPath(this.dir, id), (tmpPath) =>
        writeJsonFile(tmpPath, result)
      );
    }
  }

  // Appends the entry and leaves the step a receipt for it, on the attempt the
  // request named: a rearmed step owes nothing to the old attempt's commit.
  private record(
    request: BrokerRequest,
    result: Extract<BrokerResult, { kind: 'commit' }>
  ): void {
    const entry = commitResultToLedgerEntry(
      result.result,
      request.stepId,
      result.absorbedStepIds
    );
    if (!entry) return;
    updateRunState(this.dir, (fresh) => {
      const index = fresh.commits.length;
      const next = appendCommit(
        fresh,
        attachIssueIdsToCommitEntry(fresh, entry)
      );
      return {
        ...next,
        steps: next.steps.map((s) =>
          s.id === request.stepId && s.attempt === request.attempt
            ? { ...s, commitLedgerIndex: index }
            : s
        ),
      };
    });
  }

  private async answer(
    request: BrokerRequest,
    lease: TreeLease
  ): Promise<BrokerResult> {
    const state = readRunState(this.dir);
    const step = state.steps.find((s) => s.id === request.stepId);
    if (
      !Object.hasOwn(SEAM_STATUSES, request.kind) ||
      !isAtSeam(step, request) ||
      ((request.kind === 'commit' ||
        request.kind === 'reset' ||
        request.kind === 'give-up') &&
        !this.policy.createCommits) ||
      (request.commitAs !== undefined && request.commitAs !== 'adopt')
    ) {
      return { kind: 'stale' };
    }
    if (request.kind === 'give-up') {
      const output = new DeferredOutputCollector();
      const outcome = await giveUpWithCommit({
        root: this.root,
        dir: this.dir,
        step,
        lease,
        skipInstall: this.policy.skipInstall,
        reconcileCommand: this.reconcileCommand,
        output,
      });
      // Raw package-manager output only for a failed install, as for a commit.
      return {
        kind: 'give-up',
        outcome,
        output: output.render(
          outcome.kind === 'given-up' &&
            outcome.commit.status === 'install-failed'
            ? 'keep'
            : 'drop'
        ),
      };
    }
    if (request.kind === 'reset') {
      try {
        resetForCleanRetry(this.root, this.dir, step.id);
        return { kind: 'reset' };
      } catch (e) {
        return {
          kind: 'reset',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    const output = new DeferredOutputCollector();
    const install = () =>
      installDepsChangedSinceDispense(
        this.root,
        this.dir,
        step,
        this.policy.skipInstall,
        this.reconcileCommand,
        output
      );
    try {
      if (request.kind !== 'commit') {
        await install();
        return { kind: 'installed', output: output.render('drop') };
      }
      const absorbedStepIds = uncoveredFailedStepIds(state).filter(
        (id) => id !== step.id
      );
      const result = await commitMigrationIfRequested(
        this.root,
        { name: commitNameForStep(step, request.commitAs) },
        true,
        state.commitPrefix,
        install,
        stepsToPendingMigrations(state, absorbedStepIds),
        undefined,
        output
      );
      return {
        kind: 'commit',
        result,
        absorbedStepIds,
        output: output.render('drop'),
      };
    } catch (e) {
      // The install is the only thing that throws: the commit reports through
      // its result, and the install's own bookkeeping never throws. Marked
      // here, where the install ran, on the attempt it ran for: a reconcile
      // may have rearmed the step meanwhile, and that attempt owes nothing.
      updateRunState(this.dir, (fresh) =>
        isAtSeam(
          fresh.steps.find((s) => s.id === step.id),
          request
        )
          ? markInstallFailed(fresh, step.id)
          : null
      );
      return {
        kind: 'install-failed',
        message: e instanceof Error ? e.message : String(e),
        peerDeps: e instanceof NpmPeerDepsInstallError,
        // The package manager's own output: for pnpm, Yarn and Bun the error
        // says only that the command failed.
        output: output.render('keep'),
      };
    }
  }

  /** Releases the lock; call after the last `service` settled. */
  close(): void {
    this.lock?.unlock();
    // A reservation this session still holds would only expire with its pid.
    try {
      releaseTreeOperation(this.dir, this.nonce);
    } catch {}
    // Hygiene only; a file left behind is never read by another session.
    try {
      if (handoffsDirState(brokerDir(this.dir)) !== 'directory') return;
      for (const name of readdirSync(brokerDir(this.dir))) {
        if (
          name === `${this.nonce}.lock` ||
          (name.startsWith(`${this.nonce}-`) && name.endsWith('.request.json'))
        ) {
          rmSync(join(brokerDir(this.dir), name), { force: true });
        }
      }
    } catch {}
  }

  private notADirectory(): Error {
    return new Error(
      `The migrate run has something other than a directory at ${brokerDir(
        this.dir
      )}; remove it and try again.`
    );
  }
}
