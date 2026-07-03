import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';

/**
 * Persists a build output (imageid/digest/metadata) under Nx's workspace-data cache directory,
 * mirroring the original's `node_modules/.cache/nx-container/<project>/<name>` convention but
 * using Nx's own cache location instead of a plugin-specific one under `node_modules`.
 */
export function writeExecutorOutput(
  projectName: string,
  name: string,
  value: string
): void {
  const outputDir = join(workspaceDataDirectory, 'docker-build', projectName);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, name), value);
}
