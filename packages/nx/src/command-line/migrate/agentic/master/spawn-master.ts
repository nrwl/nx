import { type ChildProcess, spawn } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { logger } from '../../../../utils/logger';
import { output } from '../../../../utils/output';
import { resetSgrAfterAgent } from '../../migrate-output';
import {
  BROKER_ENV_VAR,
  MigrateCommitBroker,
  type MigrateRunPolicy,
  runDir,
  runHandoffsDir,
  treeOperationLabel,
} from '../../run';
import {
  AGENT_GRACEFUL_EXIT_MS,
  closeAgentSession,
  type ExitInfo,
  FORCE_KILL_WAIT_MS,
  raceWithTimeout,
  waitForExit,
} from '../close-agent-session';
import { ensureRunSubdir } from '../handoff';
import { restoreTermiosAfterAgent } from '../terminal-repair';
import type { DetectedInstalledAgent } from '../types';
import {
  type AdaptedSpawn,
  adaptSpawnForWindowsShim,
  WINDOWS_COMMAND_LINE_BUDGET,
  WINDOWS_COMMAND_LINE_LIMIT,
  withinCommandLineBudget,
} from '../windows-cmd';
import { buildMasterInvocation } from './invocations';

export interface SpawnMasterSessionInput {
  agent: DetectedInstalledAgent;
  runRoot: string;
  runId: string;
  runbookPath: string;
  reconcileCommand: string;
  policy: MigrateRunPolicy;
  sentinelPollIntervalMs?: number;
  gracefulExitMs?: number;
  forceKillWaitMs?: number;
}

export type SpawnMasterSessionResult =
  | { kind: 'exited' }
  | { kind: 'spawn-failed'; error: Error }
  // The session was closed because a request it made could not be answered.
  | { kind: 'broker-failed'; error: Error };

// The wrapper's local re-exec sets the first two for its own hop and the user
// sets the third to reach this path; inherited, they would change install or
// routing behavior for every `nx migrate` the agent runs.
const STRIPPED_ENV_VARS = [
  'NX_MIGRATE_SKIP_INSTALL',
  'NX_MIGRATE_USE_LOCAL',
  'NX_MIGRATE_ORCHESTRATOR',
];

// Under handoffs/ so claude's run-scoped Edit rule already admits the write;
// nothing lists that directory. The nonce keeps a sentinel left by an earlier
// session of the same run from closing this one.
function sessionCompleteSentinel(
  runRoot: string,
  runId: string,
  nonce: string
): string {
  return join(
    runHandoffsDir(runDir(runRoot, runId)),
    `session-complete-${nonce}`
  );
}

/**
 * Spawns the agent once, with the run's pinned invariant and bootstrap prompt,
 * and waits for the session to end, closing it once the agent writes the
 * session-complete sentinel. Meanwhile it answers the install and commit
 * requests the steps the agent runs hand out of its sandbox. Every failure
 * before the process starts is returned as `spawn-failed`; what the session
 * did is read from run state by the caller, never from the exit code.
 */
export async function spawnMasterSession(
  input: SpawnMasterSessionInput
): Promise<SpawnMasterSessionResult> {
  const {
    agent,
    runRoot,
    runId,
    runbookPath,
    reconcileCommand,
    policy,
    sentinelPollIntervalMs = 500,
    gracefulExitMs = AGENT_GRACEFUL_EXIT_MS,
    forceKillWaitMs = FORCE_KILL_WAIT_MS,
  } = input;
  let sentinelPath: string;
  let child: ChildProcess;
  let broker: MigrateCommitBroker | undefined;
  try {
    // Locked before the agent exists: a step must never find the lock free
    // while its parent is alive.
    broker = new MigrateCommitBroker(
      runRoot,
      runDir(runRoot, runId),
      reconcileCommand,
      policy
    );
    sentinelPath = sessionCompleteSentinel(runRoot, runId, broker.nonce);
    const spec = buildMasterInvocation(agent.id, {
      runId,
      reconcileCommand,
      runbookPath: prosePath(runRoot, runbookPath),
      sentinelPath: prosePath(runRoot, sentinelPath),
    });
    const env = { ...process.env, ...spec.env };
    for (const name of STRIPPED_ENV_VARS) {
      delete env[name];
    }
    env[BROKER_ENV_VAR] = broker.nonce;
    const adapted = adaptSpawnForWindowsShim(agent.binary, spec.args, {
      stdio: 'inherit',
      cwd: runRoot,
      env,
      windowsHide: true,
    });
    assertWithinWindowsCommandLineBudget(adapted, agent, runId);
    // A symlink here would send the agent's write and the poll below elsewhere.
    const handoffsDir = dirname(sentinelPath);
    ensureRunSubdir(
      handoffsDir,
      () =>
        new Error(
          `Migrate run ${runId} has something other than a directory at ${handoffsDir}; remove it and try again.`
        )
    );
    // Local alias so `@nx/workspace-require-windows-hide` can track the
    // options as an Identifier.
    const spawnOptions = adapted.options;
    child = spawn(adapted.binary, adapted.args, spawnOptions);
  } catch (error) {
    broker?.close();
    return { kind: 'spawn-failed', error: toError(error) };
  }

  // Ctrl+C belongs to the agent from the moment it exists.
  const swallowSigint = () => {};
  process.on('SIGINT', swallowSigint);
  const sentinelWatch = new AbortController();
  let brokerFailure: Error | undefined;
  // Settles when the poll aborts and the request in flight is answered, or
  // early when a request could not be answered at all.
  const brokerDone = serviceBrokerUntilAborted(
    broker,
    sentinelPollIntervalMs,
    sentinelWatch.signal
  ).catch((error) => {
    brokerFailure = toError(error);
  });
  let started = false;
  try {
    const exitPromise = waitForExit(child);
    // The usual missing-binary failure is an `error` event with no `exit`
    // (ENOENT after detection); before `spawn` it is a failure to start, not
    // a session that ended.
    const spawnError = await new Promise<Error | null>((resolve) => {
      child.once('spawn', () => resolve(null));
      child.once('error', (error) => resolve(error));
    });
    if (spawnError) {
      return { kind: 'spawn-failed', error: spawnError };
    }
    started = true;
    let exit: ExitInfo = {};
    const winner = await Promise.race([
      exitPromise.then((info) => {
        exit = info;
        return 'exit' as const;
      }),
      waitForFile(
        sentinelPath,
        sentinelPollIntervalMs,
        sentinelWatch.signal
      ).then(() => 'sentinel' as const),
      brokerDone.then(() => 'broker-failed' as const),
    ]);
    if (winner !== 'exit') {
      await closeAgentSession(
        child,
        exitPromise,
        gracefulExitMs,
        forceKillWaitMs
      );
      // The close can return on `exitCode` while `waitForExit` is still in
      // its merge window; bounded so a stuck child cannot hold the run.
      await raceWithTimeout(exitPromise, forceKillWaitMs);
    }
    if (winner === 'sentinel') {
      // Hygiene only; run state decides the outcome, not this removal.
      try {
        rmSync(sentinelPath, { force: true });
      } catch (error) {
        logger.verbose(
          `Could not remove ${sentinelPath}: ${toError(error).message}`
        );
      }
    }
    logger.verbose(
      `${agent.displayName} session ended (code: ${exit.code ?? 'none'}, signal: ${
        exit.signal ?? 'none'
      }${exit.error ? `, error: ${exit.error.message}` : ''}).`
    );
  } finally {
    sentinelWatch.abort();
    // With the agent gone, the terminal is restored before the wait: an
    // agent that left it raw would keep a Ctrl+C from reaching the operation
    // in flight as a signal.
    const exited = child.exitCode !== null || child.signalCode !== null;
    if (started && exited) {
      restoreTerminal();
      warnOperationInFlight(broker);
    }
    // The request in flight settles before the lock is released.
    await brokerDone;
    broker.close();
    process.removeListener('SIGINT', swallowSigint);
    if (started && !exited) restoreTerminal();
  }
  return brokerFailure
    ? { kind: 'broker-failed', error: brokerFailure }
    : { kind: 'exited' };
}

function restoreTerminal(): void {
  restoreTermiosAfterAgent();
  resetSgrAfterAgent();
}

// With the agent gone a Ctrl+C reaches the operation's child process, and
// nothing else tells the user one is still running.
function warnOperationInFlight(broker: MigrateCommitBroker): void {
  const request = broker.requestInFlight;
  if (!request) return;
  output.warn({
    title: `Still running ${treeOperationLabel(
      request
    )} for this migrate run. Press Ctrl+C to end it; the run can be resumed afterwards.`,
  });
}

async function serviceBrokerUntilAborted(
  broker: MigrateCommitBroker,
  intervalMs: number,
  signal: AbortSignal
): Promise<void> {
  while (!signal.aborted) {
    await broker.service();
    await delayUnlessAborted(intervalMs, signal);
  }
}

function delayUnlessAborted(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

// Workspace-relative with forward slashes on every platform: prose the agent
// reads, not a shell path.
function prosePath(runRoot: string, path: string): string {
  return relative(runRoot, path).split(sep).join('/');
}

// Never settles after an abort; the race it feeds has settled by then.
function waitForFile(
  path: string,
  intervalMs: number,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve) => {
    let timer: NodeJS.Timeout;
    const tick = () => {
      if (signal.aborted) return;
      if (existsSync(path)) {
        resolve();
        return;
      }
      timer = setTimeout(tick, intervalMs);
    };
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    timer = setTimeout(tick, intervalMs);
  });
}

function assertWithinWindowsCommandLineBudget(
  adapted: AdaptedSpawn,
  agent: DetectedInstalledAgent,
  runId: string
): void {
  if (withinCommandLineBudget(adapted)) {
    return;
  }
  throw new Error(
    `Launching ${agent.displayName} needs a ${adapted.commandLineLength}-character command line. cmd.exe runs at most ${WINDOWS_COMMAND_LINE_LIMIT} characters, and nx stops at ${WINDOWS_COMMAND_LINE_BUDGET} to leave room for what it cannot measure from here. ` +
      `What varies is the cmd.exe path (${adapted.binary.length} characters), the agent path (${agent.binary.length} characters) and the run id (${runId.length} characters); shorten one of them.`
  );
}
