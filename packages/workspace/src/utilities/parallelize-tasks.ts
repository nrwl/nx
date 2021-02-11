import { GeneratorCallback } from '@nrwl/devkit';

export function parallelizeTasks(
  ...tasks: GeneratorCallback[]
): GeneratorCallback {
  return async () => {
    await Promise.all(tasks.map((task) => task()));
  };
}
