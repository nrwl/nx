import { availableParallelism, cpus } from 'node:os';

export function concurrency(val?: string | number): number {
  if (val === undefined || val === null) {
    return 1;
  }

  let parallel = typeof val === 'number' ? val : stringToNumber(val);
  if (parallel >= 1) {
    return Math.floor(parallel);
  }

  const maxCores = availableParallelism?.() ?? cpus().length;
  parallel = maxCores * parallel;
  return Math.max(1, Math.floor(parallel));
}

function stringToNumber(input: string): number {
  const percentMatch = input.match(/^(\d+\.?\d*)%$/);
  if (percentMatch) {
    return parseFloat(percentMatch[1]) / 100;
  }

  const numericMatch = input.match(/^-?\d+\.?\d*$/);
  if (numericMatch) {
    return parseFloat(input);
  }

  return 1;
}
