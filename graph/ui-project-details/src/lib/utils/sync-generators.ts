/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';

export function getTaskSyncGenerators(
  targetConfiguration: TargetConfiguration,
  disabledTaskSyncGenerators: string[] | undefined
): {
  enabledSyncGenerators: string[];
  disabledSyncGenerators: string[];
} {
  const enabledSyncGenerators: string[] = [];
  const disabledSyncGenerators: string[] = [];

  if (!targetConfiguration.syncGenerators?.length) {
    return { enabledSyncGenerators, disabledSyncGenerators };
  }

  if (!disabledTaskSyncGenerators?.length) {
    enabledSyncGenerators.push(...targetConfiguration.syncGenerators);
    return { enabledSyncGenerators, disabledSyncGenerators };
  }

  const disabledGeneratorsSet = new Set(disabledTaskSyncGenerators);
  for (const generator of targetConfiguration.syncGenerators) {
    if (disabledGeneratorsSet.has(generator)) {
      disabledSyncGenerators.push(generator);
    } else {
      enabledSyncGenerators.push(generator);
    }
  }

  return { enabledSyncGenerators, disabledSyncGenerators };
}
