// Internal to run/: deliberately not re-exported from ./index.
//
// A master session's agent runs the dispensed `nx migrate` commands inside
// its own sandbox, where a dependency install has no network and a commit
// cannot write `.git`. The parent nx that spawned the session advertises
// itself through NX_MIGRATE_BROKER, and a step then hands its install and
// commit over a request/result file pair under <runDir>/broker/ instead of
// running them itself. Nothing here authorizes: every file the parent could
// consult lives in the workspace the sandboxed side can write, and installs
// and commits always ran unsandboxed from the process the user started. The
// parent's checks only keep a stale attempt or a duplicate request from
// landing twice.

import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { FileLock, IS_WASM } from '../../../native';
import { readJsonFile, writeJsonFile } from '../../../utils/fileutils';
import {
  DeferredOutputCollector,
  replayDeferredOutput,
  type DeferredOutputRecord,
} from '../deferred-output';
import {
  commitMigrationIfRequested,
  type CommitResult,
} from '../migrate-commits';
import { publishFileAtomically } from './atomic-write';
import {
  readRunState,
  type MigrateStep,
  type MigrateStepStatus,
} from './run-state';
import { updateRunState } from './state-lock';
import {
  markInstallFailed,
  splitMigrationId,
  stepsToPendingMigrations,
  uncoveredFailedStepIds,
} from './state-machine';
import { installDepsChangedSinceDispense } from './util';

export const BROKER_ENV_VAR = 'NX_MIGRATE_BROKER';
const BROKER_DIR_NAME = 'broker';
const CHILD_POLL_INTERVAL_MS = 250;

export interface BrokerRequest {
  stepId: string;
  attempt: number;
  // The caller's effective value: the run's policy and this invocation's flag.
  skipInstall: boolean;
}

export type BrokerResult =
  | {
      kind: 'commit';
      result: CommitResult;
      absorbedStepIds: string[];
      output: DeferredOutputRecord[];
    }
  | { kind: 'install-failed'; message: string; output: DeferredOutputRecord[] }
  | { kind: 'stale' };

export interface BrokeredCommit {
  result: CommitResult;
  absorbedStepIds: string[];
}

/** The request no longer matches the step: another attempt owns it. */
export class BrokerStaleRequestError extends Error {}

/**
 * The advertised parent could not accept the request, or went away before
 * answering it. It may have landed the install or the commit; the tree and
 * the run state say.
 */
export class BrokerUnavailableError extends Error {}

// The statuses a step has at the seams that commit: a worker mid-run, a fold
// of a handed-back prompt, an adopted death.
const COMMIT_SEAM_STATUSES: ReadonlySet<MigrateStepStatus> = new Set([
  'running',
  'awaiting-prompt-outcome',
  'died',
]);

function isAtCommitSeam(
  step: MigrateStep | undefined,
  request: BrokerRequest
): boolean {
  return (
    step !== undefined &&
    step.attempt === request.attempt &&
    COMMIT_SEAM_STATUSES.has(step.status)
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
  skipInstall: boolean,
  absorbedStepIds: string[],
  commitInProcess: () => Promise<CommitResult>
): Promise<BrokeredCommit> {
  const nonce = process.env[BROKER_ENV_VAR];
  if (!nonce) {
    return { result: await commitInProcess(), absorbedStepIds };
  }
  return requestBrokeredCommit(dir, nonce, step, skipInstall);
}

async function requestBrokeredCommit(
  dir: string,
  nonce: string,
  step: MigrateStep,
  skipInstall: boolean
): Promise<BrokeredCommit> {
  const id = `${nonce}-${step.id}-${step.attempt}`;
  const request: BrokerRequest = {
    stepId: step.id,
    attempt: step.attempt,
    skipInstall,
  };
  try {
    publishFileAtomically(requestPath(dir, id), (tmpPath) =>
      writeJsonFile(tmpPath, request)
    );
  } catch (e) {
    throw new BrokerUnavailableError(
      `The nx migrate session that started this step is not accepting its commit request (${
        e instanceof Error ? e.message : String(e)
      }).`
    );
  }
  // No deadline: an install or a commit over a large tree takes as long as it
  // takes. The parent's death releases the lock, and that is the only way
  // out without a result. Probed on one instance: each constructed one holds
  // a descriptor, and `wait()` would pin this process until the session ends.
  // A probe that cannot be built says nothing about the parent.
  let lock: FileLock | null = null;
  try {
    lock = IS_WASM ? null : new FileLock(lockPath(dir, nonce));
  } catch {}
  for (;;) {
    const path = resultPath(dir, id);
    if (existsSync(path)) {
      return settle(readJsonFile<BrokerResult>(path));
    }
    if (lock && lockIsFree(lock)) {
      throw new BrokerUnavailableError(
        `The nx migrate session that started this step ended before its commit request was answered.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, CHILD_POLL_INTERVAL_MS));
  }
}

// A probe that fails says nothing about the parent; keep waiting.
function lockIsFree(lock: FileLock): boolean {
  try {
    return !lock.check();
  } catch {
    return false;
  }
}

function settle(result: BrokerResult): BrokeredCommit {
  switch (result.kind) {
    case 'commit':
      replayDeferredOutput(result.output);
      return {
        result: result.result,
        absorbedStepIds: result.absorbedStepIds,
      };
    case 'install-failed':
      replayDeferredOutput(result.output);
      throw new Error(result.message);
    case 'stale':
      throw new BrokerStaleRequestError(
        `The commit request for this step no longer matches its attempt; nothing was installed or committed.`
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
 * once, and removes its own files on close. Requests carrying another
 * session's nonce belong to that session and are never touched.
 */
export class MigrateCommitBroker {
  readonly nonce = randomBytes(4).toString('hex');
  private readonly handled = new Set<string>();
  // Kept referenced: the lock is released when the instance is collected.
  private readonly lock: FileLock | null;

  constructor(
    private readonly root: string,
    private readonly dir: string,
    private readonly reconcileCommand: string
  ) {
    mkdirSync(brokerDir(dir), { recursive: true });
    this.lock = IS_WASM ? null : new FileLock(lockPath(dir, this.nonce));
    this.lock?.lock();
  }

  /** Answers this session's unanswered requests, one at a time. */
  async service(): Promise<void> {
    const prefix = `${this.nonce}-`;
    const suffix = '.request.json';
    for (const name of readdirSync(brokerDir(this.dir))) {
      if (!name.startsWith(prefix) || !name.endsWith(suffix)) continue;
      const id = name.slice(0, -suffix.length);
      if (this.handled.has(id)) continue;
      this.handled.add(id);
      const result = await this.answer(
        readJsonFile<BrokerRequest>(requestPath(this.dir, id))
      );
      publishFileAtomically(resultPath(this.dir, id), (tmpPath) =>
        writeJsonFile(tmpPath, result)
      );
    }
  }

  private async answer(request: BrokerRequest): Promise<BrokerResult> {
    const state = readRunState(this.dir);
    const step = state.steps.find((s) => s.id === request.stepId);
    if (!state.createCommits || !isAtCommitSeam(step, request)) {
      return { kind: 'stale' };
    }
    const absorbedStepIds = uncoveredFailedStepIds(state).filter(
      (id) => id !== step.id
    );
    const output = new DeferredOutputCollector();
    try {
      const result = await commitMigrationIfRequested(
        this.root,
        { name: splitMigrationId(step.migrationId).name },
        true,
        state.commitPrefix,
        () =>
          installDepsChangedSinceDispense(
            this.root,
            this.dir,
            step,
            request.skipInstall,
            this.reconcileCommand,
            output
          ),
        stepsToPendingMigrations(state, absorbedStepIds),
        undefined,
        output
      );
      return {
        kind: 'commit',
        result,
        absorbedStepIds,
        output: output.render(),
      };
    } catch (e) {
      // The install is the only thing that throws: the commit reports through
      // its result, and the install's own bookkeeping never throws. Marked
      // here, where the install ran, on the attempt it ran for: a reconcile
      // may have rearmed the step meanwhile, and that attempt owes nothing.
      updateRunState(this.dir, (fresh) =>
        isAtCommitSeam(
          fresh.steps.find((s) => s.id === step.id),
          request
        )
          ? markInstallFailed(fresh, step.id)
          : null
      );
      return {
        kind: 'install-failed',
        message: e instanceof Error ? e.message : String(e),
        output: output.render(),
      };
    }
  }

  /** Releases the lock; call after the last `service` settled. */
  close(): void {
    this.lock?.unlock();
    // Hygiene only; a file left behind is never read by another session.
    try {
      for (const name of readdirSync(brokerDir(this.dir))) {
        if (name.startsWith(this.nonce)) {
          rmSync(join(brokerDir(this.dir), name), { force: true });
        }
      }
    } catch {}
  }
}
