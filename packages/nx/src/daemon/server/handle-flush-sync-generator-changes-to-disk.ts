import type { HandlerResult } from './server';
import { flushSyncGeneratorChangesToDisk } from './sync-generators.js';

export async function handleFlushSyncGeneratorChangesToDisk(
  generators: string[]
): Promise<HandlerResult> {
  const result = await flushSyncGeneratorChangesToDisk(generators);

  return {
    response: result,
    description: 'handleFlushSyncGeneratorChangesToDisk',
  };
}
