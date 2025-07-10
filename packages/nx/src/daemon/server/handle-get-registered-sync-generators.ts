import type { HandlerResult } from './server';
import { getCachedRegisteredSyncGenerators } from './sync-generators';

export async function handleGetRegisteredSyncGenerators(): Promise<HandlerResult> {
  const syncGenerators = await getCachedRegisteredSyncGenerators();

  return {
    response: JSON.stringify(syncGenerators),
    description: 'handleGetSyncGeneratorChanges',
  };
}
