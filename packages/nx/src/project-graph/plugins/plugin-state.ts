import type { PluginConfiguration } from '../../config/nx-json';
import { hashObject } from '../../hasher/file-hasher';

/**
 * Identity of a loaded plugin set. Root `customConditions` are worker startup
 * flags, so a change reloads the whole set, in-process plugins included.
 */
export function hashPluginState(
  plugins: PluginConfiguration[] | undefined,
  customConditions: string[]
): string {
  return hashObject({ plugins: plugins ?? [], customConditions });
}
