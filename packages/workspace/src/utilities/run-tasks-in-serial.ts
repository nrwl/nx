import type { GeneratorCallback } from '@nx/devkit';

/**
 * Run tasks in serial
 *
 * @deprecated This function will be removed from `@nx/workspace` in version 17. Prefer importing it from `@nx/devkit`.
 * @param tasks The tasks to run in serial.
 */
export function runTasksInSerial(
  ...tasks: GeneratorCallback[]
): GeneratorCallback {
  return async () => {
    for (const task of tasks) {
      await task();
    }
  };
}
