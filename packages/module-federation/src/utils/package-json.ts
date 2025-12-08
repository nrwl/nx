import { joinPathFragments, readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import type { PackageJson } from 'nx/src/utils/package-json';

// Cache for root package.json to avoid repeated file reads
let cachedRootPackageJson: PackageJson | undefined;

export function readRootPackageJson(): PackageJson {
  if (cachedRootPackageJson) {
    return cachedRootPackageJson;
  }

  const pkgJsonPath = joinPathFragments(workspaceRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      'NX MF: Could not find root package.json to determine dependency versions.'
    );
  }

  cachedRootPackageJson = readJsonFile(pkgJsonPath);
  return cachedRootPackageJson;
}

/**
 * Clears the cached root package.json.
 * Primarily used for testing purposes.
 */
export function clearRootPackageJsonCache(): void {
  cachedRootPackageJson = undefined;
}
