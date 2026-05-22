import { ChildProcess, execSync, spawn, SpawnOptions } from 'child_process';
import { extname } from 'path';
import { migratePrompt } from '../safe-prompt';
import { readHandoff, waitForValidHandoff } from './handoff';
import {
  AgentDefinition,
  DetectedInstalledAgent,
  HandoffOutcome,
  InvocationContext,
} from './types';

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
    // windowsHide is duplicated as a literal here to satisfy the
    // @nx/workspace-require-windows-hide lint rule; adapted.options already
    // carries it.
    child = spawn(adapted.binary, adapted.args, {
      ...adapted.options,
      windowsHide: true,
    });
  } catch {
    return resolveFromHandoffOrPrompt(handoffFilePath);
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
  // Polls for a valid handoff file. When the agent's instructions tell it to
  // write the handoff JSON as its last step, this races ahead of the agent's
  // own exit (interactive REPL agents may stay open at a prompt) so the
  // orchestrator can close the session itself.
  const handoffPromise = waitForValidHandoff(handoffFilePath, {
    signal: handoffWatchAbort.signal,
    intervalMs: handoffPollIntervalMs,
  });

  try {
    const winner = await Promise.race([
      exitPromise.then(() => 'exit' as const),
      // The rejection handler swallows the abort-triggered rejection that
      // fires from the `finally` block below after the race has already
      // settled — without it node would log it as an unhandled rejection.
      handoffPromise.then(
        () => 'handoff' as const,
        () => 'exit' as const
      ),
    ]);
    if (winner === 'handoff') {
      await closeAgentSession(child, exitPromise);
    }
  } finally {
    handoffWatchAbort.abort();
    process.removeListener('SIGINT', swallowSigint);
    // Some agent TUIs (notably Codex) clear ICANON/ECHO/OPOST when they
    // take over the controlling tty and do not restore them on exit —
    // particularly when we close them via SIGINT. With OPOST off, every
    // subsequent `\n` we emit is a bare line-feed (no implicit CR) and the
    // per-migration output renders as a column-skewed staircase. They also
    // leave inline TUI cells painted on rows our wrapped log lines partially
    // overwrite, so cells past the end of our text bleed through as
    // unrelated fragments.
    restoreTerminalAfterAgent();
  }

  return resolveFromHandoffOrPrompt(handoffFilePath, userInterruptCount > 0);
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
 */
async function closeAgentSession(
  child: ChildProcess,
  exitPromise: Promise<void>
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
        }, AGENT_GRACEFUL_EXIT_MS);
      }),
    ]);
  } finally {
    if (escalation) clearTimeout(escalation);
  }
  // If we escalated via SIGTERM, wait for the actual exit.
  await exitPromise;
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.on('exit', done);
    // `error` fires when spawn itself fails (e.g. binary disappeared between
    // detection and run). Treat it as exit with no handoff so the ambiguous
    // flow kicks in.
    child.on('error', done);
  });
}

async function resolveFromHandoffOrPrompt(
  handoffFilePath: string,
  userInterrupted = false
): Promise<HandoffOutcome> {
  const handoff = readHandoff(handoffFilePath);
  if (handoff !== null) {
    return {
      kind: handoff.status,
      summary: handoff.summary,
      extras: handoff.extras,
    };
  }
  if (userInterrupted) {
    // The user pressed Ctrl+C during the agent run. Don't show the
    // abort/continue prompt — they already told us what they want, and
    // the TTY state after a SIGINT-killed child trips enquirer's
    // setRawMode-EIO and ERR_USE_AFTER_CLOSE bugs anyway. The orchestrator
    // surfaces the abort outcome via its standard failure cascade (`✗
    // Aborted by user.` / `NX Prompt migration … was aborted by user.`)
    // so no additional message is needed here.
    return { kind: 'ambiguous-abort' };
  }
  return promptAmbiguous();
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

async function promptAmbiguous(): Promise<HandoffOutcome> {
  // Blank line keeps the prompt from gluing to the agent's exit message
  // (e.g. Claude Code's "Resume this session with: claude --resume <id>"),
  // which would otherwise sit immediately above this question.
  console.log();
  // `migratePrompt` injects `options.cancel` so Ctrl+C and Esc exit cleanly
  // via `process.exit(130)` before enquirer's broken cancel cleanup runs.
  // Any other rejection (programmatic or otherwise) we treat as abort.
  try {
    const response = await migratePrompt<{ choice: 'abort' | 'continue' }>({
      name: 'choice',
      type: 'select',
      message:
        'The agent did not write a handoff file. How should nx migrate proceed?',
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
