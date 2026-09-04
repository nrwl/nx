import type { PluginConfiguration } from '../../config/nx-json';
import { hashObject } from '../../hasher/file-hasher';

/**
 * Identity of a loaded plugin set. The root `customConditions` are part of it
 * because a source-loaded isolated worker takes them as process flags at
 * spawn, so a change has to reload the set. In-process plugins share the
 * cache, so they reload with it.
 */
export function hashPluginState(
  plugins: PluginConfiguration[] | undefined,
  customConditions: string[]
): string {
  return hashObject({ plugins: plugins ?? [], customConditions });
}
