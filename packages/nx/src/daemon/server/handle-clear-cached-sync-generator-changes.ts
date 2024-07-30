import type { HandlerResult } from './server';
import { clearCachedSyncGeneratorChanges } from './sync-generators';

export async function handleClearCachedSyncGeneratorChanges(
  generators: string[]
): Promise<HandlerResult> {
  clearCachedSyncGeneratorChanges(generators);

  return {
    response: '{}',
    description: 'handleClearCachedSyncGeneratorChanges',
  };
}
