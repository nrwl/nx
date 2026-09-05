import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { extname } from 'path';
import { output } from '../../../utils/output';
import { reportMigratePrompt } from '../migrate-analytics';
import { migrateChoice } from '../safe-prompt';
import {
  AGENT_GRACEFUL_EXIT_MS,
  closeAgentSession,
  ExitInfo,
  FORCE_KILL_WAIT_MS,
  raceWithTimeout,
  waitForExit,
} from './close-agent-session';
import {
  HandoffReadFailureReason,
  readHandoffWithReason,
  waitForValidHandoff,
} from './handoff';
import { restoreTermiosAfterAgent } from './terminal-repair';
import {
  AgentDefinition,
  DetectedInstalledAgent,
  HandoffOutcome,
  InvocationContext,
} from './types';
import { quoteCmdArg } from './windows-cmd';

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

export interface RunAgenticArgs {
  detected: DetectedInstalledAgent;
  definition: AgentDefinition;
  invocationContext: InvocationContext;
  handoffFilePath: string;
  /** Directory the handoff sits in; passing a parent instead skips the symlink guard. */
  handoffsDir: string;
  /** Override the handoff-file poll interval (test seam). */
  handoffPollIntervalMs?: number;
  /** Override the SIGINT-to-SIGKILL grace period (test seam). */
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
    handoffsDir,
    handoffPollIntervalMs,
    gracefulExitMs = AGENT_GRACEFUL_EXIT_MS,
    forceKillWaitMs = FORCE_KILL_WAIT_MS,
  } = args;
  const spec = definition.buildInteractive(invocationContext);

  const adapted = adaptSpawnForWindowsShim(detected.binary, spec.args, {
    stdio: 'inherit',
    cwd: spec.cwd ?? invocationContext.workspaceRoot,
    env: spec.env ? { ...process.env, ...spec.env } : process.env,
    windowsHide: true,
  });

  let child: ChildProcess;
  // Local alias so `@nx/workspace-require-windows-hide` recognizes the
  // options arg as a tracked Identifier rather than giving up on a
  // member-expression skip — keeps the lint rule strict on other call sites.
  const spawnOptions = adapted.options;
  try {
    child = spawn(adapted.binary, adapted.args, spawnOptions);
  } catch (err) {
    return resolveFromHandoffOrPrompt(handoffFilePath, handoffsDir, false, {
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
  const handoffPromise = waitForValidHandoff(handoffFilePath, handoffsDir, {
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
    handoffsDir,
    userInterruptCount > 0,
    exitInfoToCause(exitInfo)
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

async function resolveFromHandoffOrPrompt(
  handoffFilePath: string,
  handoffsDir: string,
  userInterrupted = false,
  cause: AmbiguousCause = {}
): Promise<HandoffOutcome> {
  const read = readHandoffWithReason(handoffFilePath, handoffsDir);
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

function escapeCmdArg(arg: string): string {
  return quoteCmdArg(arg).replace(CMD_META_CHARS, '^$1');
}

function escapeCmdCommand(arg: string): string {
  // cmd.exe interprets the command portion through an extra parsing pass;
  // apply the caret-escape twice so the .cmd shim sees the original.
  return escapeCmdArg(arg).replace(CMD_META_CHARS, '^$1');
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
