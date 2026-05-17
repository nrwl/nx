import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import { prompt } from 'enquirer';
import { extname } from 'path';
import { readHandoff } from './handoff';
import {
  AgentDefinition,
  DetectedInstalledAgent,
  HandoffOutcome,
  InvocationContext,
} from './types';

export interface RunAgenticArgs {
  detected: DetectedInstalledAgent;
  definition: AgentDefinition;
  invocationContext: InvocationContext;
  handoffFilePath: string;
}

/**
 * Spawns the selected agent with `stdio: 'inherit'`, swallows SIGINT while the
 * child is alive, waits for it to exit, and resolves the run's outcome from
 * the handoff file (or the user when the file is missing).
 */
export async function runAgentic(
  args: RunAgenticArgs
): Promise<HandoffOutcome> {
  const { detected, definition, invocationContext, handoffFilePath } = args;
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

  try {
    await waitForExit(child);
  } finally {
    process.removeListener('SIGINT', swallowSigint);
  }

  return resolveFromHandoffOrPrompt(handoffFilePath);
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

function escapeCmdArg(arg: string): string {
  // Backslash-escape embedded quotes per MS C runtime convention.
  let escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  escaped = `"${escaped}"`;
  return escaped.replace(CMD_META_CHARS, '^$1');
}

function escapeCmdCommand(arg: string): string {
  // cmd.exe interprets the command portion through an extra parsing pass;
  // double-escape metacharacters there so the .cmd shim sees the original.
  let escaped = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  escaped = `"${escaped}"`;
  escaped = escaped.replace(CMD_META_CHARS, '^$1');
  return escaped.replace(CMD_META_CHARS, '^$1');
}

async function promptAmbiguous(): Promise<HandoffOutcome> {
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
