/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TargetConfiguration } from '@nx/devkit';

export function getTargetExecutorSourceMapKey(
  targetConfiguration: TargetConfiguration
): string {
  if (targetConfiguration.options?.command) {
    return 'options.command';
  } else if (targetConfiguration.options?.commands) {
    return 'options.commands';
  } else if (targetConfiguration.options?.script) {
    return 'options.script';
  } else {
    return 'executor';
  }
}
