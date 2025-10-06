import { joinPathFragments, readJsonFile, workspaceRoot } from '@nx/devkit';
import { existsSync } from 'fs';
import type { PackageJson } from 'nx/src/utils/package-json';

export function readRootPackageJson(): PackageJson {
  const pkgJsonPath = joinPathFragments(workspaceRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      'NX MF: Could not find root package.json to determine dependency versions.'
    );
  }

  return readJsonFile(pkgJsonPath);
}
