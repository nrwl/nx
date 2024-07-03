import { getSyncGeneratorChanges } from '../../utils/sync-generators';
import type { HandlerResult } from './server';

export async function handleGetSyncGeneratorChanges(
  generators: string[]
): Promise<HandlerResult> {
  const changes = await getSyncGeneratorChanges(generators);

  return {
    response: JSON.stringify(changes),
    description: 'handleGetSyncGeneratorChanges',
  };
}
