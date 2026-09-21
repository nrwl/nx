// A master session's agent runs the dispensed `nx migrate` commands inside
// its own sandbox, where a dependency install has no network and a commit
// cannot write `.git`. The parent nx that spawned the session advertises
// itself through NX_MIGRATE_BROKER, and a step then hands its install, and
// its commit when one is due, over a request/result file pair under
// <runDir>/broker/ instead of running them itself. Nothing here authorizes:
// every file the parent could consult lives in the workspace the sandboxed
// side can write, and installs and commits always ran unsandboxed from the
// process the user started. The parent's checks only keep a stale attempt or
// a duplicate request from landing twice.

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
  commitResultToLedgerEntry,
  markInstallFailed,
  splitMigrationId,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
} from './state-machine';
import { attachIssueIdsToCommitEntry } from './issues';
import { resetForCleanRetry } from './clean-retry';
import { installDepsChangedSinceDispense, isPidAlive } from './util';

export const BROKER_ENV_VAR = 'NX_MIGRATE_BROKER';
const BROKER_DIR_NAME = 'broker';
const CHILD_POLL_INTERVAL_MS = 250;

// The seam a request comes from. A seam runs once per attempt, so the seam
// names the request: a repeat of the same operation (a refold after a crash,
// the adopt of a worker that died mid-commit) reads the first answer instead
// of landing twice. Commits share one seam: a worker's, the fold's and the
// adopt's are the same operation on the same tree. The reset is the
// exception: each clean retry names its own request (see `invocation`).
export type BrokerRequestKind =
  | 'commit'
  // A worker's install: after its generator, or a retry's from the baseline.
  | 'install'
  // The fold's install when it commits nothing, a retained tree included.
  | 'fold-install'
  // The install a skip or a non-commit adopt owes for the tree it keeps.
  | 'action-install'
  // A clean retry's reset of the tree to the step's starting ref.
  | 'reset';

export type InstallSeam = 'install' | 'fold-install' | 'action-install';

// Names the seam only. Whether to install or commit is the parent's own
// policy, so a request carries nothing that would widen it.
export interface BrokerRequest {
  kind: BrokerRequestKind;
  stepId: string;
  attempt: number;
  // Reset only: a fresh id per clean retry, so a second retry of the same
  // attempt resets again instead of reading the first reset's answer.
  invocation?: string;
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
  | { kind: 'stale' };

type BrokerAnswer = Extract<
  BrokerResult,
  { kind: 'commit' | 'installed' | 'reset' }
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
  updateRunState(dir, (fresh) => {
    if (!atSeam(fresh, request)) {
      throw new BrokerStaleRequestError(
        `The request for this step no longer matches its attempt; nothing was installed or committed.`
      );
    }
    const held = liveTreeOperation(fresh, owner);
    if (held) throw new TreeBusyError(treeBusyMessage(held));
    return {
      ...fresh,
      treeOperation: {
        kind: request.kind,
        ...(request.stepId !== undefined ? { stepId: request.stepId } : {}),
        ...(request.attempt !== undefined ? { attempt: request.attempt } : {}),
        owner,
        pid: process.pid,
      },
    };
  });
  return { owner, release: () => releaseTreeOperation(dir, owner) };
}

// Owner-checked: a lease released late never drops a newer reservation.
export function releaseTreeOperation(dir: string, owner: string): void {
  updateRunState(dir, (fresh) =>
    fresh.treeOperation?.owner === owner
      ? { ...fresh, treeOperation: undefined }
      : null
  );
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
  const what =
    held.kind === 'checkpoint'
      ? 'the checkpoint commit'
      : `the ${
          held.kind === 'commit' || held.kind === 'reset'
            ? held.kind
            : 'install'
        } of step '${held.stepId}'`;
  return `The working tree is held by process ${held.pid} for ${what}; run the reconcile again once it finishes.`;
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

// The statuses a step has at each seam: a worker mid-run, a fold of a
// handed-back prompt, a skipped failure or an adopted death.
const SEAM_STATUSES: Record<
  BrokerRequestKind,
  ReadonlySet<MigrateStepStatus>
> = {
  commit: new Set(['running', 'awaiting-prompt-outcome', 'died']),
  install: new Set(['running']),
  'fold-install': new Set(['awaiting-prompt-outcome']),
  'action-install': new Set(['failed', 'died']),
  reset: new Set(['failed', 'died']),
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
  scope: TreeScope
): Promise<BrokeredCommit> {
  const request: BrokerRequest = {
    kind: 'commit',
    stepId: step.id,
    attempt: step.attempt,
  };
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    scope.lease = acquireTreeOperation(dir, request);
    return {
      result: await commitInProcess(),
      absorbedStepIds,
      recorded: false,
    };
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

async function ask(
  dir: string,
  nonce: string,
  request: BrokerRequest
): Promise<BrokerAnswer> {
  const id = `${nonce}-${request.stepId}-${request.attempt}-${request.kind}${
    request.invocation ? `-${request.invocation}` : ''
  }`;
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
        result = lease ? await this.answer(request) : { kind: 'stale' };
        // Recorded by the process that ran the commit, before the answer: the
        // step reading it can die with the commit already in history. A failed
        // record throws and ends the session rather than losing the entry.
        if (result.kind === 'commit') this.record(request, result);
      } finally {
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

  private async answer(request: BrokerRequest): Promise<BrokerResult> {
    const state = readRunState(this.dir);
    const step = state.steps.find((s) => s.id === request.stepId);
    if (
      !Object.hasOwn(SEAM_STATUSES, request.kind) ||
      !isAtSeam(step, request) ||
      ((request.kind === 'commit' || request.kind === 'reset') &&
        !this.policy.createCommits)
    ) {
      return { kind: 'stale' };
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
        { name: splitMigrationId(step.migrationId).name },
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
