import type { HandlerResult } from './server';
import { getCachedSyncGeneratorChanges } from './sync-generators';

export async function handleGetSyncGeneratorChanges(
  generators: string[]
): Promise<HandlerResult> {
  const changes = await getCachedSyncGeneratorChanges(generators);

  return {
    response: JSON.stringify(changes),
    description: 'handleGetSyncGeneratorChanges',
  };
}
