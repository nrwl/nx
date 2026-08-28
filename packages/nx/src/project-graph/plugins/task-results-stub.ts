import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import type { TaskResult, TaskResults } from '../../tasks-runner/life-cycle';
import { terminalOutputPathForHash } from '../../tasks-runner/terminal-output-path';
import { logger } from '../../utils/logger';
import type { PostTasksExecutionContext } from './public-api';

/**
 * A {@link PostTasksExecutionContext} whose terminal outputs have been lifted
 * out of `taskResults` and into a map of the paths holding them, so it can
 * cross a process boundary.
 *
 * `taskResults` carries every task's full output inline, which on a large
 * workspace exceeds V8's maximum string length: `serialize` tries
 * `JSON.stringify` and falls back to `v8.serialize(...).toString('binary')`,
 * and both have to materialize the payload as a single string, so both throw.
 * The bytes are already on disk at `<cacheDir>/terminalOutputs/<hash>`, so
 * transports carry paths and each receiver reads them back before any plugin
 * sees the context.
 *
 * The paths live here rather than in `terminalOutput` so that field never
 * holds two meanings: a stubbed result carries no `terminalOutput` at all, so
 * a transport that forgets to rehydrate hands a plugin a missing value rather
 * than a filename shaped exactly like real output. The map is required, so a
 * stubbed context cannot typecheck without one.
 */
export type StubbedPostTasksExecutionContext = PostTasksExecutionContext & {
  /**
   * Path to the terminal output of each stubbed task, keyed by task id. Out of
   * band because a task can print anything, so no in-band marker is safe from
   * a task that prints it.
   */
  stubbedTerminalOutputs: Record<string, string>;
};

export type MaybeStubbedPostTasksExecutionContext =
  | PostTasksExecutionContext
  | StubbedPostTasksExecutionContext;

function isStubbed(
  context: MaybeStubbedPostTasksExecutionContext
): context is StubbedPostTasksExecutionContext {
  return !!(context as StubbedPostTasksExecutionContext).stubbedTerminalOutputs;
}

/**
 * Swaps outputs out for paths ahead of a transport. Idempotent, so a context
 * already stubbed for the daemon can be passed on to a plugin worker as-is.
 */
export function stubTerminalOutputs(
  context: MaybeStubbedPostTasksExecutionContext
): MaybeStubbedPostTasksExecutionContext {
  if (!context.taskResults) {
    return context;
  }

  const stubbedTerminalOutputs: Record<string, string> = {
    ...(isStubbed(context) ? context.stubbedTerminalOutputs : {}),
  };
  const taskResults: TaskResults = {};
  let swapped = false;

  for (const [id, result] of Object.entries(context.taskResults)) {
    const path = id in stubbedTerminalOutputs ? null : stubbablePath(result);
    if (path) {
      const { terminalOutput, ...withoutOutput } = result;
      stubbedTerminalOutputs[id] = path;
      taskResults[id] = withoutOutput as TaskResult;
      swapped = true;
    } else {
      taskResults[id] = result;
    }
  }

  // Nothing to swap: hand back the context as it came, so a run with no
  // outputs on disk sends exactly what it sent before. Covers the
  // already-stubbed case too, which keeps its own map by staying untouched.
  if (!swapped) {
    return context;
  }

  return { ...context, taskResults, stubbedTerminalOutputs };
}

/**
 * Reads the outputs back. A no-op on a context that was never stubbed, which
 * is every in-process plugin run without the daemon.
 */
export function rehydrateTerminalOutputs(
  context: MaybeStubbedPostTasksExecutionContext
): PostTasksExecutionContext {
  if (!isStubbed(context)) {
    return context;
  }

  const taskResults: TaskResults = { ...context.taskResults };
  for (const [id, path] of Object.entries(context.stubbedTerminalOutputs)) {
    const result = taskResults[id];
    if (!result) {
      continue;
    }
    taskResults[id] = { ...result, terminalOutput: readTerminalOutput(path) };
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
function stubbablePath(result: TaskResult): string | null {
  if (result.terminalOutput === undefined) {
    return null;
  }
  const hash = result.task?.hash;
  if (!hash) {
    return null;
  }
  // `getCustomHasher` lets a plugin return any string, and this one reaches a
  // read, so the sink is kept inside the cache dir here rather than trusted to
  // the hasher. A hash that needed stripping resolves to a file that does not
  // exist, which falls back to sending the output inline.
  const path = terminalOutputPathForHash(basename(hash));
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
