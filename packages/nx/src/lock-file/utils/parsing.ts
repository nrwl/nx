import { workspaceRoot } from '../../utils/workspace-root';
import { existsSync, readFileSync } from 'fs';

/**
 * Checks whether the package is a root dependency
 * @param packageName
 * @param version
 * @returns
 */
export function getRootVersion(packageName: string): string {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version;
  } else {
    throw new Error(
      `Could not find package.json for "${packageName}" at "${fullPath}"`
    );
  }
}
