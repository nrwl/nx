import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import { extname } from 'path';
import { migratePrompt } from '../safe-prompt';
import {
  HandoffReadFailureReason,
  readHandoffWithReason,
  waitForValidHandoff,
} from './handoff';
import {
  AgentDefinition,
  DetectedInstalledAgent,
  HandoffOutcome,
  InvocationContext,
} from './types';

/**
 * Carries the underlying failure mode into the ambiguous-outcome prompt so the
 * user can see *why* the agent's handoff is missing/malformed (spawn ENOENT,
 * non-zero exit, JSON parse error, …) instead of every cause collapsing into
 * the same "the agent did not write a handoff" message.
 */
interface AmbiguousCause {
  spawnError?: string;
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  exitError?: string;
  handoff?: { reason: HandoffReadFailureReason; detail?: string };
}

// How long to wait for the agent to exit gracefully after sending SIGINT once
// a valid handoff has been written. Long enough for an interactive agent to
// finish its current render and clean up; short enough that a frozen child
// still gets escalated to SIGTERM in a sensible time.
const AGENT_GRACEFUL_EXIT_MS = 5_000;

export interface RunAgenticArgs {
  detected: DetectedInstalledAgent;
  definition: AgentDefinition;
  invocationContext: InvocationContext;
  handoffFilePath: string;
  /** Override the handoff-file poll interval (test seam). */
  handoffPollIntervalMs?: number;
  /** Override the SIGINT-to-SIGTERM grace period (test seam). */
  gracefulExitMs?: number;
}

/**
 * Spawns the selected agent with `stdio: 'inherit'`, swallows SIGINT while the
 * child is alive, waits for it to exit, and resolves the run's outcome from
 * the handoff file (or the user when the file is missing).
 */
export async function runAgentic(
  args: RunAgenticArgs
): Promise<HandoffOutcome> {
  const {
    detected,
    definition,
    invocationContext,
    handoffFilePath,
    handoffPollIntervalMs,
    gracefulExitMs = AGENT_GRACEFUL_EXIT_MS,
  } = args;
  const spec = definition.buildInteractive(invocationContext);

  const adapted = adaptSpawnForWindowsShim(detected.binary, spec.args, {
    stdio: 'inherit',
    cwd: spec.cwd ?? invocationContext.workspaceRoot,
    env: spec.env ? { ...process.env, ...spec.env } : process.env,
    windowsHide: true,
  });

  let child: ChildProcess;
  try {
    child = spawn(adapted.binary, adapted.args, {
      ...adapted.options,
      windowsHide: true,
    });
  } catch (err) {
    return resolveFromHandoffOrPrompt(handoffFilePath, false, {
      spawnError: err instanceof Error ? err.message : String(err),
    });
  }

  // Counts user-initiated SIGINTs caught while the agent runs. The agent
  // owns the terminal and handles its own SIGINT semantics, so we swallow
  // at the process level. A non-zero count after the agent exits tells the
  // resolver "the user pressed Ctrl+C" → skip the abort/continue prompt
  // and abort directly. This isn't just UX: enquirer misbehaves in the
  // wonky TTY state that follows a SIGINT-killed child (Bug A:
  // ERR_USE_AFTER_CLOSE during cancel cleanup; Bug B: setRawMode EIO
  // during prompt initialization). Both surface as EventEmitter errors /
  // unhandled rejections from async chains an `await` try/catch cannot
  // intercept, so bypassing enquirer entirely is the safe path.
  let userInterruptCount = 0;
  const swallowSigint = () => {
    userInterruptCount++;
  };
  process.on('SIGINT', swallowSigint);

  const handoffWatchAbort = new AbortController();
  const exitPromise = waitForExit(child);
  const handoffPromise = waitForValidHandoff(handoffFilePath, {
    signal: handoffWatchAbort.signal,
    intervalMs: handoffPollIntervalMs,
  });

  let exitInfo: ExitInfo = {};
  try {
    const winner = await Promise.race([
      exitPromise.then((info) => {
        exitInfo = info;
        return 'exit' as const;
      }),
      // Rejection handler swallows the abort-triggered rejection from the
      // `finally` block after the race has settled — otherwise Node logs it
      // as an unhandled rejection.
      handoffPromise.then(
        () => 'handoff' as const,
        () => 'exit' as const
      ),
    ]);
    if (winner === 'handoff') {
      await closeAgentSession(child, exitPromise, gracefulExitMs);
      exitInfo = await exitPromise;
    }
  } finally {
    handoffWatchAbort.abort();
    process.removeListener('SIGINT', swallowSigint);
    restoreTerminalAfterAgent();
  }

  return resolveFromHandoffOrPrompt(
    handoffFilePath,
    userInterruptCount > 0,
    exitInfoToCause(exitInfo)
  );
}

function exitInfoToCause(info: ExitInfo): AmbiguousCause {
  const cause: AmbiguousCause = {};
  if (info.code !== undefined && info.code !== null && info.code !== 0) {
    cause.exitCode = info.code;
  }
  if (info.signal) cause.exitSignal = info.signal;
  if (info.error) cause.exitError = info.error.message;
  return cause;
}

function restoreTerminalAfterAgent(): void {
  // OPOST is a POSIX termios flag; Windows consoles don't use it.
  if (process.platform === 'win32') return;
  if (!process.stdin.isTTY) return;
  try {
    // `stty sane` resets termios to a known cooked state via the kernel —
    // independent of Node's libuv mode tracking (Node's setRawMode(false)
    // short-circuits when libuv's per-handle mode is already NORMAL, even
    // if the OS-level termios was changed out-of-band by the agent).
    execSync('stty sane < /dev/tty', {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });
    // `\r` → column 0 of the current row.
    // `\x1B[J` → clear from cursor to end of screen. Wipes any agent TUI
    //   cells on or below our row that our subsequent log lines won't
    //   overwrite (e.g., a status footer past where our text wraps).
    process.stdout.write('\r\x1B[J');
  } catch {
    // best-effort — if stty isn't on PATH or /dev/tty isn't accessible,
    // the worst case is the pre-existing staircase + cell-bleed output.
  }
}

/**
 * Sends SIGINT (graceful, equivalent to the user typing Ctrl+C in the REPL),
 * waits up to `AGENT_GRACEFUL_EXIT_MS` for the child to exit, and escalates to
 * SIGTERM as a fallback. Always resolves once the child has exited.
 *
 * Windows caveat: when `adaptSpawnForWindowsShim` wrapped the binary in
 * `cmd.exe /d /s /c "..."` (the npm `.cmd` shim path), `child.kill('SIGINT')`
 * is mapped by Node to `TerminateProcess` on the cmd.exe handle. That kills
 * cmd.exe but does not cascade to the actual agent process, which becomes
 * orphaned. A proper fix would `taskkill /T /F /PID <pid>` the cmd-shim path;
 * until then, agents that don't exit on their own after a handoff write will
 * survive on Windows. Tracked as a follow-up.
 */
async function closeAgentSession(
  child: ChildProcess,
  exitPromise: Promise<ExitInfo>,
  gracefulExitMs: number
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill('SIGINT');
  } catch {
    // child already gone between the check above and here
    return;
  }
  let escalation: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      exitPromise,
      new Promise<void>((resolve) => {
        escalation = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try {
              child.kill('SIGTERM');
            } catch {
              /* child already gone */
            }
          }
          resolve();
        }, gracefulExitMs);
      }),
    ]);
  } finally {
    if (escalation) clearTimeout(escalation);
  }
  // If we escalated via SIGTERM, wait for the actual exit.
  await exitPromise;
}

interface ExitInfo {
  code?: number | null;
  signal?: NodeJS.Signals | null;
  error?: Error;
}

function waitForExit(child: ChildProcess): Promise<ExitInfo> {
  return new Promise<ExitInfo>((resolve) => {
    let settled = false;
    const done = (info: ExitInfo) => {
      if (settled) return;
      settled = true;
      resolve(info);
    };
    child.on('exit', (code, signal) => done({ code, signal }));
    // `error` fires when spawn itself fails (e.g. binary disappeared between
    // detection and run). Treat it as exit with no handoff so the ambiguous
    // flow kicks in.
    child.on('error', (error) => done({ error }));
  });
}

async function resolveFromHandoffOrPrompt(
  handoffFilePath: string,
  userInterrupted = false,
  cause: AmbiguousCause = {}
): Promise<HandoffOutcome> {
  const read = readHandoffWithReason(handoffFilePath);
  if (read.ok) {
    return {
      kind: read.handoff.status,
      summary: read.handoff.summary,
      extras: read.handoff.extras,
    };
  }
  if (userInterrupted) {
    // User pressed Ctrl+C. Don't show the abort/continue prompt — they
    // already told us what they want, and the TTY state after a
    // SIGINT-killed child trips enquirer's setRawMode-EIO and
    // ERR_USE_AFTER_CLOSE bugs. The orchestrator's standard failure
    // cascade surfaces the abort outcome.
    return { kind: 'ambiguous-abort' };
  }
  return promptAmbiguous({
    ...cause,
    handoff: { reason: read.reason, detail: read.detail },
  });
}

/**
 * Node's `spawn` cannot directly execute `.cmd` / `.bat` shims on Windows;
 * `which` resolves to those when an agent was installed via npm. Wrap them in
 * a `cmd.exe /d /s /c` invocation with `windowsVerbatimArguments` so quoting
 * follows the cmd.exe convention rather than Node's default cooking.
 *
 * On non-Windows or for non-shim binaries this is a passthrough.
 */
export function adaptSpawnForWindowsShim(
  binary: string,
  args: readonly string[],
  options: SpawnOptions
): { binary: string; args: string[]; options: SpawnOptions } {
  if (process.platform !== 'win32') {
    return { binary, args: [...args], options };
  }
  const ext = extname(binary).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') {
    return { binary, args: [...args], options };
  }

  const cmdLine = [escapeCmdCommand(binary), ...args.map(escapeCmdArg)].join(
    ' '
  );
  return {
    binary: process.env.comspec || 'cmd.exe',
    // Outer pair of quotes is required so cmd.exe /c does not strip the inner
    // quotes around the binary path.
    args: ['/d', '/s', '/c', `"${cmdLine}"`],
    options: { ...options, windowsVerbatimArguments: true },
  };
}

const CMD_META_CHARS = /([()\][%!^"`<>&|;, ])/g;

// Backslash-escape embedded quotes per MS C runtime convention, wrap in
// quotes, then caret-escape cmd.exe metacharacters.
function escapeCmdArg(arg: string): string {
  const quoted = `"${arg
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, '$1$1')}"`;
  return quoted.replace(CMD_META_CHARS, '^$1');
}

function escapeCmdCommand(arg: string): string {
  // cmd.exe interprets the command portion through an extra parsing pass;
  // apply the caret-escape twice so the .cmd shim sees the original.
  return escapeCmdArg(arg).replace(CMD_META_CHARS, '^$1');
}

async function promptAmbiguous(cause: AmbiguousCause): Promise<HandoffOutcome> {
  // Blank line keeps the prompt from gluing to the agent's exit message
  // (e.g. Claude Code's "Resume this session with: claude --resume <id>"),
  // which would otherwise sit immediately above this question.
  console.log();
  const causeLines = describeAmbiguousCause(cause);
  const lead =
    causeLines.length > 0
      ? [
          'The agent run ended without a usable handoff:',
          ...causeLines.map((l) => `  ${l}`),
          '',
        ]
      : [];
  const message = [...lead, 'How should nx migrate proceed?'].join('\n');
  // `migratePrompt` injects `options.cancel` so Ctrl+C and Esc exit cleanly
  // via `process.exit(130)` before enquirer's broken cancel cleanup runs.
  // Any other rejection we treat as abort.
  try {
    const response = await migratePrompt<{ choice: 'abort' | 'continue' }>({
      name: 'choice',
      type: 'select',
      message,
      choices: [
        { name: 'abort', message: 'Treat as failed — abort the run' },
        {
          name: 'continue',
          message: 'Treat as completed — mark done and continue',
        },
      ],
    });
    return response.choice === 'continue'
      ? { kind: 'ambiguous-continue' }
      : { kind: 'ambiguous-abort' };
  } catch {
    return { kind: 'ambiguous-abort' };
  }
}

function describeAmbiguousCause(cause: AmbiguousCause): string[] {
  const lines: string[] = [];
  if (cause.spawnError) {
    lines.push(`Could not spawn the agent: ${cause.spawnError}`);
  }
  if (cause.exitError) {
    lines.push(`Agent process emitted an error: ${cause.exitError}`);
  }
  if (cause.exitCode !== undefined && cause.exitCode !== null) {
    lines.push(`Agent exited with code ${cause.exitCode}.`);
  }
  if (cause.exitSignal) {
    lines.push(`Agent was terminated by signal ${cause.exitSignal}.`);
  }
  switch (cause.handoff?.reason) {
    case 'missing':
      lines.push('No handoff file was written.');
      break;
    case 'read-error':
      lines.push(
        `Handoff file could not be read${
          cause.handoff.detail ? `: ${cause.handoff.detail}` : '.'
        }`
      );
      break;
    case 'parse-error':
      lines.push(
        `Handoff file contained invalid JSON${
          cause.handoff.detail ? `: ${cause.handoff.detail}` : '.'
        }`
      );
      break;
    case 'shape-mismatch':
      lines.push(
        'Handoff file was missing required fields or had an unexpected shape.'
      );
      break;
  }
  return lines;
}
