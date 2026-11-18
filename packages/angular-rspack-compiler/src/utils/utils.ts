import { availableParallelism, platform } from 'node:os';
import { ENV_NG_BUILD_MAX_WORKERS } from './constants';

export const isUsingWindows = () => platform() === 'win32';

export function isPresent(variable: string | undefined): variable is string {
  return typeof variable === 'string' && variable.trim() !== '';
}

export function parseMaxWorkers(value: string | undefined): number | null {
  if (!isPresent(value)) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed; // Ensure valid positive number
}

export const maxWorkers = () => {
  const parsedWorkers = parseMaxWorkers(process.env[ENV_NG_BUILD_MAX_WORKERS]);
  return parsedWorkers !== null
    ? parsedWorkers
    : Math.min(4, Math.max(availableParallelism() - 1, 1));
};

/**
 * The JavaScript transformer's worker count on `@angular/build` >= 22.2, as
 * its `maxTransformWorkers` computes it. That transformer keeps a fixed pool of
 * this size and rejects anything but an integer >= 1.
 */
export const maxTransformWorkers = () => {
  const value = process.env[ENV_NG_BUILD_MAX_WORKERS];
  const parsed = isPresent(value) ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 1
    ? parsed
    : Math.max(1, Math.min(6, Math.floor(availableParallelism() / 4)));
};
