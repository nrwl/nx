import { join } from 'path';
import { cacheDir } from '../utils/cache-directory';

/**
 * Where a task's terminal output lives on disk, for callers that have a hash but
 * no cache instance. Mirrors the native layout (`get_task_outputs_path_internal`
 * in cache.rs) and the legacy cache's `terminalOutputsDir`; both resolve
 * `<cacheDir>/terminalOutputs/<hash>`.
 *
 * Its own module rather than part of `cache.ts` so the graph and plugin paths
 * can resolve a path without pulling the cache — and the database, cloud and
 * task-IO modules behind it — into their import graph.
 */
export function terminalOutputPathForHash(hash: string): string {
  return join(cacheDir, 'terminalOutputs', hash);
}
