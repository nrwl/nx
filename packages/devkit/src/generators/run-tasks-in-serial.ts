import type { GeneratorCallback } from 'nx/src/config/misc-interfaces';

/**
 * Run tasks in serial
 *
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
