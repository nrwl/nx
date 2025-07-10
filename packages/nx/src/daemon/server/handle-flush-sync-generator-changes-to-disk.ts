import type { HandlerResult } from './server';
import { flushSyncGeneratorChangesToDisk } from './sync-generators';

export async function handleFlushSyncGeneratorChangesToDisk(
  generators: string[]
): Promise<HandlerResult> {
  const result = await flushSyncGeneratorChangesToDisk(generators);

  return {
    response: JSON.stringify(result),
    description: 'handleFlushSyncGeneratorChangesToDisk',
  };
}
