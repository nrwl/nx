import { dirname } from 'path';

/**
 * Pulled from toFileName in names from @nx/devkit.
 * Todo: Should refactor, not duplicate.
 */
export function toProjectName(fileName: string): string {
  const parts = dirname(fileName).split(/[\/\\]/g);
  return parts[parts.length - 1].toLowerCase();
}
