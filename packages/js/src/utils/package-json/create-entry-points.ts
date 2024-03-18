import { sync as globSync } from 'fast-glob';
import { logger } from '@nx/devkit';

export function createEntryPoints(
  additionalEntryPoints: undefined | string[],
  root: string
): string[] {
  if (!additionalEntryPoints?.length) return [];
  const files = [];
  // NOTE: calling globSync for each pattern is slower than calling it all at once.
  // We're doing it this way in order to show a warning for unmatched patterns.
  // If a pattern is unmatched, it is very likely a mistake by the user.
  // Performance impact should be negligible since there shouldn't be that many entry points.
  // Benchmarks show only 1-3% difference in execution time.
  for (const pattern of additionalEntryPoints) {
    const matched = globSync([pattern], { cwd: root });
    if (!matched.length)
      logger.warn(`The pattern ${pattern} did not match any files.`);
    files.push(...matched);
  }
  return files;
}
