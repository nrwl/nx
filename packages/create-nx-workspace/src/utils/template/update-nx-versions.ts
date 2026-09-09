import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'path';

/**
 * Updates package.json content so that `nx` and all `@nx/*` packages point to
 * the given version. Template repositories always track the latest Nx release,
 * so without this a user running an older create-nx-workspace would silently
 * get the latest Nx instead of the version they asked for.
 *
 * @param packageJsonContent - The current package.json content
 * @param version - The Nx version to pin
 * @returns The updated package.json content, or the original if nothing changed
 */
export function updateNxVersionsInContent(
  packageJsonContent: string,
  version: string
): string {
  const packageJson = JSON.parse(packageJsonContent);

  let updated = false;
  for (const deps of [packageJson.dependencies, packageJson.devDependencies]) {
    if (!deps) continue;
    for (const packageName of Object.keys(deps)) {
      if (
        (packageName === 'nx' || packageName.startsWith('@nx/')) &&
        deps[packageName] !== version
      ) {
        deps[packageName] = version;
        updated = true;
      }
    }
  }

  return updated
    ? JSON.stringify(packageJson, null, 2) + '\n'
    : packageJsonContent;
}

/**
 * Aligns the Nx packages in the given workspace's root package.json with the
 * provided version. The nested package.json files in the Nx template repos do
 * not declare Nx dependencies, so only the root needs updating.
 *
 * @param directory - The workspace directory containing package.json
 * @param version - The Nx version to pin
 * @returns true if the file was modified, false otherwise
 */
export function updateNxVersions(directory: string, version: string): boolean {
  const packageJsonPath = join(directory, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const content = readFileSync(packageJsonPath, 'utf-8');
  const updated = updateNxVersionsInContent(content, version);

  if (updated !== content) {
    writeFileSync(packageJsonPath, updated);
    return true;
  }

  return false;
}
