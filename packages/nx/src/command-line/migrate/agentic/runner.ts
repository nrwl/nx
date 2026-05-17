import { ChildProcess, spawn } from 'child_process';
import { prompt } from 'enquirer';
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

  let child: ChildProcess;
  try {
    child = spawn(detected.binary, spec.args, {
      stdio: 'inherit',
      cwd: spec.cwd ?? invocationContext.workspaceRoot,
      env: spec.env ? { ...process.env, ...spec.env } : process.env,
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
