import type { PluginConfiguration } from '../../config/nx-json';
import { hashObject } from '../../hasher/file-hasher';

/**
 * Plugin set identity. A conditions change replaces the specified plugin workers;
 * in-process plugins keep Node's module cache until the daemon restarts.
 */
export function hashPluginState(
  plugins: PluginConfiguration[] | undefined,
  customConditions: string[]
): string {
  return hashObject({ plugins: plugins ?? [], customConditions });
}
