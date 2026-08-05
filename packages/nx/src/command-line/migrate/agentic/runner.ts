import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import { extname } from 'path';
import * as pc from 'picocolors';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import { reportMigratePrompt } from '../migrate-analytics';
import { migrateChoice } from '../safe-prompt';
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
  /** Override the post-force-kill safety bound (test seam). */
  forceKillWaitMs?: number;
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
    forceKillWaitMs = FORCE_KILL_WAIT_MS,
  } = args;
  const adapted = adaptWithinCommandLineBudget(
    detected,
    definition,
    invocationContext
  );

  let child: ChildProcess;
  // Local alias so `@nx/workspace-require-windows-hide` recognizes the
  // options arg as a tracked Identifier rather than giving up on a
  // member-expression skip — keeps the lint rule strict on other call sites.
  const spawnOptions = adapted.options;
  try {
    child = spawn(adapted.binary, adapted.args, spawnOptions);
  } catch (err) {
    return resolveFromHandoffOrPrompt(handoffFilePath, false, {
      spawnError: err instanceof Error ? err.message : String(err),
    });
  }

  // Counts SIGINTs while the agent runs. Non-zero after exit means the
  // user pressed Ctrl+C → skip the ambiguous abort/continue prompt. Prompting
  // in the TTY state left by a SIGINT-killed child misbehaved under enquirer
  // (ERR_USE_AFTER_CLOSE, setRawMode EIO) from async chains `await` could not
  // catch. Whether @clack/prompts shares that fault is unverified, so the skip
  // stays; reproducing it needs a real terminal.
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
      await closeAgentSession(
        child,
        exitPromise,
        gracefulExitMs,
        forceKillWaitMs
      );
      // Extra safety bound so the orchestrator can't hang if the child
      // stays stuck after SIGKILL / taskkill (e.g. D-state on a hung NFS
      // read, or taskkill returning before the process actually exits).
      await raceWithTimeout(exitPromise, forceKillWaitMs);
    }
  } finally {
    handoffWatchAbort.abort();
    process.removeListener('SIGINT', swallowSigint);
    restoreTermiosAfterAgent();
  }

  return resolveFromHandoffOrPrompt(
    handoffFilePath,
    userInterruptCount > 0,
    exitInfoToCause(exitInfo)
  );
}

// "The maximum length of the string that you can use at the command prompt is
// 8191 characters".
// https://learn.microsoft.com/troubleshoot/windows-client/shell-experience/command-line-string-limitation
const WINDOWS_COMMAND_LINE_LIMIT = 8191;
// Absorbs what cannot be measured from here: cmd.exe's own accounting of the
// string it receives, and headroom for the prompts to grow.
const WINDOWS_COMMAND_LINE_RESERVE = 1000;
export const WINDOWS_COMMAND_LINE_BUDGET =
  WINDOWS_COMMAND_LINE_LIMIT - WINDOWS_COMMAND_LINE_RESERVE;

/**
 * Builds the spawn arguments, keeping them within what Windows will execute.
 *
 * The prompts themselves already travel as files, so the only term that can
 * still push the command line over is the workspace path, which every path in
 * the arguments is built from. When it does, the agents that carry a system
 * context on the command line fall back to the shorter form; there is nothing
 * left to trade after that, so an argument list still over the limit aborts
 * the step rather than dispatching the agent on a truncated one.
 */
function adaptWithinCommandLineBudget(
  detected: DetectedInstalledAgent,
  definition: AgentDefinition,
  invocationContext: InvocationContext
): AdaptedSpawn {
  const adapt = (ctx: InvocationContext): AdaptedSpawn => {
    const spec = definition.buildInteractive(ctx);
    return adaptSpawnForWindowsShim(detected.binary, spec.args, {
      stdio: 'inherit',
      cwd: spec.cwd ?? ctx.workspaceRoot,
      env: spec.env ? { ...process.env, ...spec.env } : process.env,
      windowsHide: true,
    });
  };

  const adapted = adapt(invocationContext);
  if (withinCommandLineBudget(adapted)) {
    return adapted;
  }

  const reduced = adapt({
    ...invocationContext,
    inlineSystemContext: invocationContext.inlineSystemContextFallback,
  });
  if (withinCommandLineBudget(reduced)) {
    logger.info(
      pc.dim(
        `  Passing the agent a reduced set of instructions. The workspace path leaves no room for the full set on a Windows command line.`
      )
    );
    return reduced;
  }

  output.error({
    title: `${detected.displayName} cannot be started from this workspace path`,
    bodyLines: [
      `Launching it needs a ${reduced.commandLineLength}-character command line. cmd.exe runs at most ${WINDOWS_COMMAND_LINE_LIMIT} characters, and nx stops at ${WINDOWS_COMMAND_LINE_BUDGET} to leave room for what it cannot measure from here.`,
      `The workspace path accounts for most of it, at ${invocationContext.workspaceRoot.length} characters.`,
      ``,
      `Move the workspace to a shorter path, or re-run with \`--agentic=false\` to apply the remaining migrations yourself.`,
    ],
  });
  throw new Error(
    `Cannot start ${detected.displayName}: the command line exceeds the Windows limit.`
  );
}

function withinCommandLineBudget(adapted: AdaptedSpawn): boolean {
  return (
    adapted.commandLineLength === undefined ||
    adapted.commandLineLength <= WINDOWS_COMMAND_LINE_BUDGET
  );
}

function exitInfoToCause(info: ExitInfo): AmbiguousCause {
  const cause: AmbiguousCause = {};
  // Include `code === 0` so the prompt can distinguish "agent exited cleanly
  // without writing a handoff" (likely the user closed the agent on purpose,
  // or the agent terminated without invoking the handoff step) from "agent
  // was killed before it could write" (signal) or "agent crashed" (non-zero
  // code). Without this distinction every clean-exit-no-handoff collapses
  // into the same uninformative ambiguous-prompt body.
  if (info.code !== undefined && info.code !== null) {
    cause.exitCode = info.code;
  }
  if (info.signal) cause.exitSignal = info.signal;
  if (info.error) cause.exitError = info.error.message;
  return cause;
}

function restoreTermiosAfterAgent(): void {
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
    // Carriage-return + clear to end of screen, to wipe any agent TUI
    // cells below our row that subsequent log lines won't overwrite
    // (e.g. a status footer past where our text wraps).
    process.stdout.write('\r\x1B[J');
  } catch {
    // best-effort — if stty isn't on PATH or /dev/tty isn't accessible,
    // the worst case is the pre-existing staircase + cell-bleed output.
  }
}

// Safety bound after force-kill. SIGKILL normally reaps in microseconds;
// the bound exists for uninterruptible kernel calls or taskkill returning
// before the process actually exits.
const FORCE_KILL_WAIT_MS = 500;

/**
 * Stops the agent process after a successful handoff. Platform-branched:
 *
 * - POSIX: SIGINT (graceful, equivalent to user Ctrl+C) → wait
 *   `gracefulExitMs` for the child to exit → SIGKILL → wait
 *   `FORCE_KILL_WAIT_MS` (bounded) → return. SIGTERM is intentionally
 *   skipped: a process that ignores SIGINT for 5s will hit the same
 *   handler on SIGTERM, the extra step only delays the inevitable.
 *
 * - Windows: skip SIGINT entirely. `child.kill('*')` on Windows is a
 *   `TerminateProcess` call regardless of the signal name (Windows has
 *   no POSIX signals), and on the `cmd.exe` shim path it
 *   would terminate cmd.exe while leaving the agent orphaned (parent
 *   death doesn't cascade to children on Windows). `taskkill /T /F`
 *   walks the process tree and kills cmd.exe AND the agent atomically;
 *   that's the only reliable shutdown path here. `taskkill` failures
 *   (binary missing, race with already-dead pid) are swallowed; the
 *   safety bound returns regardless.
 */
async function closeAgentSession(
  child: ChildProcess,
  exitPromise: Promise<ExitInfo>,
  gracefulExitMs: number,
  forceKillWaitMs: number
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === 'win32') {
    await forceKillWindowsTree(child, exitPromise, forceKillWaitMs);
    return;
  }

  // POSIX path.
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
        escalation = setTimeout(resolve, gracefulExitMs);
      }),
    ]);
  } finally {
    if (escalation) clearTimeout(escalation);
  }
  if (child.exitCode !== null || child.signalCode !== null) return;

  // Graceful timeout elapsed without the agent exiting. SIGKILL is
  // uncatchable; bound the post-kill wait so a pathological uninterruptible
  // syscall can't hang us forever.
  try {
    child.kill('SIGKILL');
  } catch {
    /* child already gone */
  }
  await raceWithTimeout(exitPromise, forceKillWaitMs);
}

async function forceKillWindowsTree(
  child: ChildProcess,
  exitPromise: Promise<ExitInfo>,
  forceKillWaitMs: number
): Promise<void> {
  const pid = child.pid;
  // `child.pid` is undefined only when spawn itself failed; the early-return
  // guard in `closeAgentSession` should short-circuit that path. Reaching
  // here without a pid means a narrow race between handoff-detection and
  // error-event propagation — without a pid we can't taskkill, so wait
  // briefly and return.
  if (pid !== undefined) {
    try {
      execSync(`taskkill /T /F /PID ${pid}`, {
        stdio: 'ignore',
        windowsHide: true,
        // Bound so a hung Windows shell can't block the orchestrator.
        timeout: 2_000,
      });
    } catch {
      /* taskkill missing, pid already dead, or timed out — fall through */
    }
  }
  await raceWithTimeout(exitPromise, forceKillWaitMs);
}

async function raceWithTimeout(
  promise: Promise<unknown>,
  timeoutMs: number
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface ExitInfo {
  code?: number | null;
  signal?: NodeJS.Signals | null;
  error?: Error;
}

// Merge window so a paired exit + error both land in the same ExitInfo
// (e.g. error from IPC followed by exit when the process actually
// terminates). For error-only paths like spawn ENOENT — where Node fires
// error but never exit — this timer is the SOLE settlement mechanism.
const EXIT_MERGE_WINDOW_MS = 10;

function waitForExit(child: ChildProcess): Promise<ExitInfo> {
  return new Promise<ExitInfo>((resolve) => {
    const info: ExitInfo = {};
    let pending: NodeJS.Timeout | null = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      if (pending) clearTimeout(pending);
      resolve(info);
    };
    const onFirst = () => {
      if (settled || pending) return;
      pending = setTimeout(settle, EXIT_MERGE_WINDOW_MS);
    };
    child.on('exit', (code, signal) => {
      info.code = code;
      info.signal = signal;
      onFirst();
    });
    // `error` fires when spawn itself fails (e.g. binary disappeared between
    // detection and run) OR alongside `exit` when the process started but
    // emitted an error event later. Treat both as exit with no handoff so
    // the ambiguous flow kicks in; field-merge so we don't drop the loser's
    // contribution when both fire.
    child.on('error', (error) => {
      info.error = error;
      onFirst();
    });
  });
}

async function resolveFromHandoffOrPrompt(
  handoffFilePath: string,
  userInterrupted = false,
  cause: AmbiguousCause = {}
): Promise<HandoffOutcome> {
  const read = readHandoffWithReason(handoffFilePath);
  if (read.ok === true) {
    return {
      kind: read.handoff.status,
      summary: read.handoff.summary,
      extras: read.handoff.extras,
    };
  }
  const fullCause: AmbiguousCause = {
    ...cause,
    handoff: { reason: read.reason, detail: read.detail },
  };
  if (userInterrupted) {
    // User pressed Ctrl+C. Don't show the abort/continue prompt — they
    // already told us what they want. Prompting in the TTY state left by a
    // SIGINT-killed child also tripped enquirer's setRawMode-EIO and
    // ERR_USE_AFTER_CLOSE bugs; whether @clack/prompts shares that fault is
    // unverified, so the skip stays. The orchestrator's standard failure
    // cascade surfaces the abort outcome.
    //
    // Forward the underlying cause as pre-rendered summary lines so the
    // caller can log it before "Aborted by user" — a Ctrl+C that masked
    // a SEPARATE crash still needs to show the user what crashed. Scrub
    // fields that are just the Ctrl+C itself reverberating: exit code
    // 130 (SIGINT) / 143 (SIGTERM from our escalation) and signals
    // SIGINT / SIGTERM reflect the user's own keystroke (and our
    // graceful-exit handling of it); surfacing them as "agent crashed"
    // would be noise. Anything else — code 1, code 137 (OOM), an
    // unrelated signal — is a separate diagnostic worth keeping. Note
    // that `spawnError` is structurally impossible here: the spawn-throw
    // path returns directly without registering the SIGINT listener, so
    // `userInterrupted` can never be true on that branch.
    const exitWasCtrlC =
      cause.exitCode === 130 ||
      cause.exitCode === 143 ||
      cause.exitSignal === 'SIGINT' ||
      cause.exitSignal === 'SIGTERM';
    const userScrubbed: AmbiguousCause = {
      exitError: cause.exitError,
      exitCode: exitWasCtrlC ? undefined : cause.exitCode,
      exitSignal: exitWasCtrlC ? undefined : cause.exitSignal,
      handoff:
        read.reason === 'missing'
          ? undefined
          : { reason: read.reason, detail: read.detail },
    };
    const causeSummary = describeAmbiguousCause(userScrubbed);
    return {
      kind: 'ambiguous-abort',
      ...(causeSummary.length > 0 && { causeSummary }),
    };
  }
  return promptAmbiguous(fullCause);
}

export interface AdaptedSpawn {
  binary: string;
  args: string[];
  options: SpawnOptions;
  /**
   * Length of the command line Windows will receive. Only set when the
   * `cmd.exe` wrapper was applied, since that is the only path with a limit
   * worth checking against.
   */
  commandLineLength?: number;
}

/**
 * Node's `spawn` cannot directly execute `.cmd` / `.bat` shims on Windows;
 * `which` resolves to those when an agent was installed via npm. Wrap them in
 * a `cmd.exe /c` invocation with `windowsVerbatimArguments` so quoting follows
 * the cmd.exe convention rather than Node's default cooking.
 *
 * On non-Windows or for non-shim binaries this is a passthrough.
 */
export function adaptSpawnForWindowsShim(
  binary: string,
  args: readonly string[],
  options: SpawnOptions
): AdaptedSpawn {
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
  // Both expansion modes are set rather than inherited, because a machine-wide
  // registry setting can flip either one. `/e:on` keeps command extensions on,
  // which the `%cd:~,%` substring in `neutralizePercent` needs to parse.
  // `/v:off` keeps delayed expansion off, so a `!` in an argument stays a
  // literal instead of opening a `!VAR!` reference. Same pair Rust's standard
  // library uses to run a batch file (`library/std/src/sys/args/windows.rs`).
  // Outer pair of quotes is required so cmd.exe /c does not strip the inner
  // quotes around the binary path.
  const cmdArgs = ['/e:on', '/v:off', '/d', '/s', '/c', `"${cmdLine}"`];
  return {
    binary: comspec,
    args: cmdArgs,
    options: { ...options, windowsVerbatimArguments: true },
    // `windowsVerbatimArguments` makes the command line the argv joined by
    // single spaces, so this is what CreateProcess and then cmd.exe see.
    commandLineLength: [comspec, ...cmdArgs].join(' ').length,
  };
}

/**
 * A `.cmd` shim invocation cannot carry `\r` or `\n` in an argument: no
 * escaping reproduces them on the other side, and cmd.exe truncates the
 * argument list at the break. Rust's standard library refuses them for the
 * same reason (`library/std/src/sys/args/windows.rs`), and CVE-2024-24576 came
 * out of trying to escape rather than refuse. Refusing here means a caller
 * that grows a multi-line argument fails loudly instead of dispatching an
 * agent on truncated instructions.
 */
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

const CMD_META_CHARS = /([()\][!^"`<>&|;, ])/g;

// Backslash-escape embedded quotes per MS C runtime convention, wrap in
// quotes, then caret-escape cmd.exe metacharacters.
function escapeCmdArg(arg: string): string {
  return neutralizePercent(caretEscape(quoteCmdArg(arg)));
}

function escapeCmdCommand(arg: string): string {
  // cmd.exe interprets the command portion through an extra parsing pass;
  // apply the caret-escape twice so the .cmd shim sees the original.
  return neutralizePercent(caretEscape(caretEscape(quoteCmdArg(arg))));
}

function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
}

function caretEscape(quoted: string): string {
  return quoted.replace(CMD_META_CHARS, '^$1');
}

/**
 * Stops cmd.exe expanding `%VAR%` inside an argument. A caret does not escape
 * `%`, because variable expansion runs before caret processing, so each `%`
 * is turned into `%%cd:~,%`: `%cd:~,%` is a zero-length substring of the built-in
 * `cd` variable, i.e. it expands to nothing and leaves the leading `%` behind.
 * Same substitution the Rust standard library applies to batch-file arguments.
 *
 * Runs after the caret passes so the `,` it introduces stays uncareted; cmd
 * would not recognize the substring syntax otherwise.
 */
function neutralizePercent(escaped: string): string {
  return escaped.replace(/%/g, '%%cd:~,%');
}

async function promptAmbiguous(cause: AmbiguousCause): Promise<HandoffOutcome> {
  // stderr blank line so the spacer lands in the same stream as output.warn
  // and the prompt — buffered stdout could otherwise reorder it and glue the
  // prompt to the agent's trailing exit message.
  process.stderr.write('\n');
  // Cause rendered ABOVE the prompt rather than inlined into its message:
  // enquirer's select redraw used different math for clear (wrap-aware) vs
  // restore (raw \n-split count), so a multi-line message could leave orphaned
  // cells on arrow-key re-renders. Kept single-line because that constraint is
  // unverified under @clack/prompts, not because the cause still applies.
  const causeLines = describeAmbiguousCause(cause);
  if (causeLines.length > 0) {
    output.warn({
      title: 'The agent run ended without a usable handoff',
      bodyLines: causeLines,
    });
  }
  // Cancelling exits 130 from inside the prompt; any other rejection is an
  // abort.
  try {
    const choice = await migrateChoice<'abort' | 'continue'>({
      message: 'How should nx migrate proceed?',
      choices: [
        { value: 'abort', label: 'Treat as failed — abort the run' },
        {
          value: 'continue',
          label: 'Treat as completed — mark done and continue',
        },
      ],
    });
    reportMigratePrompt('ambiguous_agent_outcome', choice);
    return choice === 'continue'
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
    // Distinguish clean-exit-without-handoff (likely a deliberate close by
    // the user, or the agent ended its session without invoking the handoff
    // step) from a non-zero crash, so the prompt body doesn't collapse them
    // into the same uninformative "exited with code N" line.
    lines.push(
      cause.exitCode === 0
        ? 'Agent exited cleanly (code 0) without writing a handoff.'
        : `Agent exited with code ${cause.exitCode}.`
    );
  }
  if (cause.exitSignal) {
    lines.push(`Agent was terminated by signal ${cause.exitSignal}.`);
  }
  // "No handoff file was written." is redundant when another cause line
  // already implies it (spawn error, exit code/signal, process error).
  // Independent diagnostics (read-error, parse-error, shape-mismatch) always
  // surface — they're not implied by the exit shape.
  const handoffMissingIsRedundant =
    !!cause.spawnError ||
    !!cause.exitError ||
    cause.exitCode !== undefined ||
    cause.exitSignal !== undefined;
  switch (cause.handoff?.reason) {
    case 'missing':
      if (!handoffMissingIsRedundant) {
        lines.push('No handoff file was written.');
      }
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
