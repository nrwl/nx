import { existsSync, readFileSync } from 'node:fs';
import type { TaskResult, TaskResults } from '../../tasks-runner/life-cycle';
import { terminalOutputPathForHash } from '../../tasks-runner/terminal-output-path';
import { logger } from '../../utils/logger';
import type { PostTasksExecutionContext } from './public-api';

/**
 * A {@link PostTasksExecutionContext} whose terminal outputs have been replaced
 * by the paths holding them, so it can cross a process boundary.
 *
 * `taskResults` carries every task's full output inline, which on a large
 * workspace exceeds V8's maximum string length: `serialize` tries
 * `JSON.stringify` and falls back to `v8.serialize(...).toString('binary')`,
 * and both have to materialize the payload as a single string, so both throw.
 * The bytes are already on disk at `<cacheDir>/terminalOutputs/<hash>`, so
 * transports carry paths and each receiver reads them back before any plugin
 * sees the context.
 */
export type StubbedPostTasksExecutionContext = PostTasksExecutionContext & {
  /**
   * Ids in `taskResults` whose `terminalOutput` holds a path rather than the
   * output. Out of band because a task can print anything, so no in-band
   * marker is safe from a task that prints it.
   */
  stubbedTerminalOutputs?: string[];
};

/**
 * Swaps in paths ahead of a transport. Idempotent, so a context that was
 * already stubbed for the daemon can be passed on to a plugin worker as-is.
 */
export function stubTerminalOutputs(
  context: PostTasksExecutionContext | StubbedPostTasksExecutionContext
): StubbedPostTasksExecutionContext {
  if (!context.taskResults) {
    return context;
  }

  const stubbed = new Set(
    (context as StubbedPostTasksExecutionContext).stubbedTerminalOutputs ?? []
  );
  const taskResults: TaskResults = {};
  let swapped = false;

  for (const [id, result] of Object.entries(context.taskResults)) {
    const path = stubbablePath(result, stubbed.has(id));
    if (path) {
      stubbed.add(id);
      taskResults[id] = { ...result, terminalOutput: path };
      swapped = true;
    } else {
      taskResults[id] = result;
    }
  }

  // Nothing to swap: hand back the context as it came, so a run with no
  // outputs on disk sends exactly what it sent before. Covers the
  // already-stubbed case too, which keeps its own list by staying untouched.
  if (!swapped) {
    return context;
  }

  return { ...context, taskResults, stubbedTerminalOutputs: [...stubbed] };
}

/**
 * Reads the outputs back. A no-op on a context that was never stubbed, which
 * is every in-process plugin run without the daemon.
 */
export function rehydrateTerminalOutputs(
  context: StubbedPostTasksExecutionContext
): PostTasksExecutionContext {
  if (!context.stubbedTerminalOutputs?.length) {
    return context;
  }

  const taskResults: TaskResults = { ...context.taskResults };
  for (const id of context.stubbedTerminalOutputs) {
    const result = taskResults[id];
    if (!result) {
      continue;
    }
    taskResults[id] = {
      ...result,
      terminalOutput: readTerminalOutput(result.terminalOutput),
    };
  }

  const { stubbedTerminalOutputs, ...rehydrated } = {
    ...context,
    taskResults,
  };
  return rehydrated;
}

/**
 * The path to swap in, or null to leave the output inline. A task that failed
 * before it was hashed has no path, and a task that never ran has no file —
 * both keep whatever they already carry rather than losing it.
 */
function stubbablePath(
  result: TaskResult,
  alreadyStubbed: boolean
): string | null {
  if (alreadyStubbed || result.terminalOutput === undefined) {
    return null;
  }
  const hash = result.task?.hash;
  if (!hash) {
    return null;
  }
  const path = terminalOutputPathForHash(hash);
  return existsSync(path) ? path : null;
}

/**
 * A path that no longer resolves means the bytes are gone. Saying so with
 * `undefined` — already a legal value, skipped tasks have it — beats leaving
 * the path, which would have plugins treat a filename as the output.
 */
function readTerminalOutput(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  try {
    return readFileSync(path, 'utf-8');
  } catch (e) {
    logger.warn(
      `Nx could not read a task's terminal output from ${path}: ${e.message}`
    );
    return undefined;
  }
}
