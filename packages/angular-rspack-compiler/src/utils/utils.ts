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
