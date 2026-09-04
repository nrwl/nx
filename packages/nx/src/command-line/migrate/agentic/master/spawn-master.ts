import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, extname, join, relative, sep } from 'path';
import { logger } from '../../../../utils/logger';
import { resetSgrAfterAgent } from '../../migrate-output';
import { BROKER_ENV_VAR, MigrateCommitBroker } from '../../run/broker';
import { runDir, runHandoffsDir } from '../../run/run-state';
import {
  AGENT_GRACEFUL_EXIT_MS,
  closeAgentSession,
  ExitInfo,
  FORCE_KILL_WAIT_MS,
  raceWithTimeout,
  waitForExit,
} from '../close-agent-session';
import { handoffsDirState } from '../handoff';
import { restoreTermiosAfterAgent } from '../terminal-repair';
import { DetectedInstalledAgent } from '../types';
import { caretEscape, neutralizePercent, quoteCmdArg } from '../windows-cmd';
import { buildMasterInvocation } from './invocations';

export interface SpawnMasterSessionInput {
  agent: DetectedInstalledAgent;
  runRoot: string;
  runId: string;
  runbookPath: string;
  reconcileCommand: string;
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

// Lives under handoffs/ because claude's run-scoped Edit rule already admits
// the write and the orchestrator reads handoffs by step id, never by listing.
// The session nonce keeps a sentinel from an earlier session of the same run,
// stale or still being written, from closing this one.
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
      reconcileCommand
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
    const adapted = adaptMasterSpawnForWindowsShim(agent.binary, spec.args, {
      stdio: 'inherit',
      cwd: runRoot,
      env,
      windowsHide: true,
    });
    assertWithinWindowsCommandLineBudget(adapted, agent, runId);
    // Recreated if the agent removed it, refused if something else stands in
    // its place: a symlink would send the agent's write and the poll below
    // elsewhere.
    const handoffsDir = dirname(sentinelPath);
    switch (handoffsDirState(handoffsDir)) {
      case 'directory':
        break;
      case 'missing':
        // Not recursive: the run dir exists, and a symlink raced in here
        // fails with EEXIST instead of being followed.
        mkdirSync(handoffsDir);
        break;
      case 'other':
        throw new Error(
          `Migrate run ${runId} has something other than a directory at ${handoffsDir}; remove it and try again.`
        );
    }
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
  // Settles once the poll is aborted and the request in flight, if any, is
  // answered; earlier only when a request could not be answered, which is
  // where it must not sit unanswered while this process lives on.
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
    // A step killed with the session still gets its commit landed; the lock
    // is released only once nothing can be waiting on an answer.
    await brokerDone;
    broker.close();
    process.removeListener('SIGINT', swallowSigint);
    if (started) {
      restoreTermiosAfterAgent();
      resetSgrAfterAgent();
    }
  }
  return brokerFailure
    ? { kind: 'broker-failed', error: brokerFailure }
    : { kind: 'exited' };
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

// Resolves once the file exists. Never settles after an abort; the race it
// feeds has settled by then.
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

// "The maximum length of the string that you can use at the command prompt is
// 8191 characters".
// https://learn.microsoft.com/troubleshoot/windows-client/shell-experience/command-line-string-limitation
const WINDOWS_COMMAND_LINE_LIMIT = 8191;
// Absorbs cmd.exe's own accounting of the string, which cannot be measured
// from here.
const WINDOWS_COMMAND_LINE_RESERVE = 1000;
export const WINDOWS_COMMAND_LINE_BUDGET =
  WINDOWS_COMMAND_LINE_LIMIT - WINDOWS_COMMAND_LINE_RESERVE;

interface AdaptedMasterSpawn {
  binary: string;
  args: string[];
  options: SpawnOptions;
  /** Set only when the `cmd.exe` wrapper was applied. */
  commandLineLength?: number;
}

/**
 * Node's `spawn` cannot execute the `.cmd` / `.bat` shims an npm install
 * leaves on Windows, so those run through `cmd.exe` with the arguments
 * escaped by hand for it. Elsewhere this is a passthrough.
 */
export function adaptMasterSpawnForWindowsShim(
  binary: string,
  args: readonly string[],
  options: SpawnOptions
): AdaptedMasterSpawn {
  if (process.platform !== 'win32') {
    return { binary, args: [...args], options };
  }
  const ext = extname(binary).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') {
    return { binary, args: [...args], options };
  }

  assertNoLineBreaks(binary, args);
  const cmdLine = [escapeCmdCommand(binary), ...args.map(escapeCmdArg)].join(
    ' '
  );
  const comspec = process.env.comspec || 'cmd.exe';
  // Both expansion modes are set rather than inherited, because a registry
  // setting can flip either one: `/e:on` keeps the command extensions the
  // `%cd:~,%` substring needs, `/v:off` keeps a `!` from opening a `!VAR!`
  // reference. The outer quotes keep cmd.exe /c from stripping the inner
  // ones around the binary path.
  const cmdArgs = ['/e:on', '/v:off', '/d', '/s', '/c', `"${cmdLine}"`];
  return {
    binary: comspec,
    args: cmdArgs,
    options: { ...options, windowsVerbatimArguments: true },
    // With `windowsVerbatimArguments` the command line is the argv joined by
    // single spaces, which is what CreateProcess and then cmd.exe see.
    commandLineLength: [comspec, ...cmdArgs].join(' ').length,
  };
}

// No escaping reproduces a line break on the other side, and cmd.exe truncates
// the command line at it; refusing beats dispatching the agent on a truncated
// prompt (CVE-2024-24576 came out of escaping instead).
function assertNoLineBreaks(binary: string, args: readonly string[]): void {
  const offending = [binary, ...args].find((value) => /[\r\n]/.test(value));
  if (offending !== undefined) {
    throw new Error(
      `Cannot pass a multi-line argument to "${binary}" on Windows: cmd.exe truncates the command line at the line break. Offending argument: ${JSON.stringify(
        offending.slice(0, 120)
      )}`
    );
  }
}

function assertWithinWindowsCommandLineBudget(
  adapted: AdaptedMasterSpawn,
  agent: DetectedInstalledAgent,
  runId: string
): void {
  if (
    adapted.commandLineLength === undefined ||
    adapted.commandLineLength <= WINDOWS_COMMAND_LINE_BUDGET
  ) {
    return;
  }
  throw new Error(
    `Launching ${agent.displayName} needs a ${adapted.commandLineLength}-character command line. cmd.exe runs at most ${WINDOWS_COMMAND_LINE_LIMIT} characters, and nx stops at ${WINDOWS_COMMAND_LINE_BUDGET} to leave room for what it cannot measure from here. ` +
      `What varies is the cmd.exe path (${adapted.binary.length} characters), the agent path (${agent.binary.length} characters) and the run id (${runId.length} characters); shorten one of them.`
  );
}

function escapeCmdArg(arg: string): string {
  return neutralizePercent(caretEscape(quoteCmdArg(arg)));
}

// cmd.exe parses the command portion twice, so it is caret-escaped twice.
function escapeCmdCommand(arg: string): string {
  return neutralizePercent(caretEscape(caretEscape(quoteCmdArg(arg))));
}
