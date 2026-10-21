import type { Task } from '../config/task-graph';
import type { TaskUltracacheSettings } from '../native';

export type UltracacheMode = NonNullable<TaskUltracacheSettings['mode']>;

const MODES: readonly UltracacheMode[] = ['on', 'warn', 'error', 'off'];

/** Read on the initiating process, never from the daemon's environment. */
export function ultracacheModeOverride(
  env: NodeJS.ProcessEnv = process.env
): UltracacheMode | undefined {
  const mode = env.NX_CLOUD_ULTRACACHE_MODE;
  if (mode === undefined) return undefined;
  if (!MODES.includes(mode as UltracacheMode)) {
    throw new Error(
      `NX_CLOUD_ULTRACACHE_MODE must be one of on, warn, error, off, but received ${JSON.stringify(mode)}.`
    );
  }
  return mode as UltracacheMode;
}

export function resolveUltracacheMode(
  settings: TaskUltracacheSettings | undefined,
  defaultMode: UltracacheMode,
  override: UltracacheMode | undefined
): UltracacheMode {
  return override ?? settings?.mode ?? defaultMode;
}

/**
 * Resolve every task before hashing, reporting PIDs or sending it to Cloud.
 * Replace the settings object so authored project configuration stays intact.
 * Agents preserve modes received from the initiating process/server, even
 * when their own environment differs. Only legacy tasks missing a mode need
 * the agent's fallback.
 */
export function resolveTaskUltracacheModes(
  tasks: Iterable<Pick<Task, 'ultracache'>>,
  defaultMode: UltracacheMode = 'on',
  override?: UltracacheMode,
  preserveResolvedModes = false
): void {
  for (const task of tasks) {
    if (preserveResolvedModes && task.ultracache?.mode !== undefined) continue;
    task.ultracache = {
      ...task.ultracache,
      mode: resolveUltracacheMode(task.ultracache, defaultMode, override),
    };
  }
}
