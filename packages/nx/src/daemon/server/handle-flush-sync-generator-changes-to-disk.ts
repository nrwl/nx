import type { HandlerResult } from './server';
import { flushSyncGeneratorChangesToDisk } from './sync-generators';

export async function handleFlushSyncGeneratorChangesToDisk(
  generators: string[]
): Promise<HandlerResult> {
  await flushSyncGeneratorChangesToDisk(generators);

  return {
    response: '{}',
    description: 'handleFlushSyncGeneratorChangesToDisk',
  };
}
