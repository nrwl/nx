import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { extname, relative, sep } from 'path';
import { logger } from '../../../../utils/logger';
import { resetSgrAfterAgent } from '../../migrate-output';
import { waitForExit } from '../close-agent-session';
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
}

export type SpawnMasterSessionResult =
  | { kind: 'exited' }
  | { kind: 'spawn-failed'; error: Error };

// The wrapper's local re-exec sets the first two for its own hop and the user
// sets the third to reach this path; inherited, they would change install or
// routing behavior for every `nx migrate` the agent runs.
const STRIPPED_ENV_VARS = [
  'NX_MIGRATE_SKIP_INSTALL',
  'NX_MIGRATE_USE_LOCAL',
  'NX_MIGRATE_ORCHESTRATOR',
];

/**
 * Spawns the agent once, with the run's pinned invariant and bootstrap prompt,
 * and waits for the session to end. Every failure before the process starts
 * is returned as `spawn-failed`; what the session did is read from run state
 * by the caller, never from the exit code.
 */
export async function spawnMasterSession(
  input: SpawnMasterSessionInput
): Promise<SpawnMasterSessionResult> {
  const { agent, runRoot, runId, runbookPath, reconcileCommand } = input;

  let child: ChildProcess;
  try {
    const spec = buildMasterInvocation(agent.id, {
      runId,
      reconcileCommand,
      runbookPath: relative(runRoot, runbookPath).split(sep).join('/'),
    });
    const env = { ...process.env, ...spec.env };
    for (const name of STRIPPED_ENV_VARS) {
      delete env[name];
    }
    const adapted = adaptMasterSpawnForWindowsShim(agent.binary, spec.args, {
      stdio: 'inherit',
      cwd: runRoot,
      env,
      windowsHide: true,
    });
    assertWithinWindowsCommandLineBudget(adapted, agent, runId);
    // Local alias so `@nx/workspace-require-windows-hide` can track the
    // options as an Identifier.
    const spawnOptions = adapted.options;
    child = spawn(adapted.binary, adapted.args, spawnOptions);
  } catch (error) {
    return { kind: 'spawn-failed', error: toError(error) };
  }

  // Ctrl+C belongs to the agent from the moment it exists.
  const swallowSigint = () => {};
  process.on('SIGINT', swallowSigint);
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
    const exit = await exitPromise;
    logger.verbose(
      `${agent.displayName} session ended (code: ${exit.code ?? 'none'}, signal: ${
        exit.signal ?? 'none'
      }${exit.error ? `, error: ${exit.error.message}` : ''}).`
    );
  } finally {
    process.removeListener('SIGINT', swallowSigint);
    if (started) {
      restoreTermiosAfterAgent();
      resetSgrAfterAgent();
    }
  }
  return { kind: 'exited' };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
