import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { prompt } from 'enquirer';
import { extname } from 'path';
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

  const swallowSigint = () => {
    /* swallow — the child controls the terminal and handles its own cleanup */
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
  }

  return resolveFromHandoffOrPrompt(handoffFilePath);
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
  handoffFilePath: string
): Promise<HandoffOutcome> {
  const handoff = readHandoff(handoffFilePath);
  if (handoff === null) {
    return promptAmbiguous();
  }
  return {
    kind: handoff.status,
    summary: handoff.summary,
    extras: handoff.extras,
  };
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
  const response = await prompt<{ choice: 'abort' | 'continue' }>({
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
}
