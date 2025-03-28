import * as path from 'path';
import { rmSync } from 'node:fs';

/**
 * Delete an output directory, but error out if it's the root of the project.
 */
export function deleteOutputDir(root: string, outputPath: string) {
  const resolvedOutputPath = path.resolve(root, outputPath);
  if (resolvedOutputPath === root) {
    throw new Error('Output path MUST not be project root directory!');
  }

  rmSync(resolvedOutputPath, { recursive: true, force: true });
}
