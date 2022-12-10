import { joinPathFragments } from 'nx/src/utils/path';
import { readJsonFile } from 'nx/src/utils/fileutils';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { existsSync } from 'fs';

export function readRootPackageJson(): {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
} {
  const pkgJsonPath = joinPathFragments(workspaceRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      'NX MF: Could not find root package.json to determine dependency versions.'
    );
  }

  return readJsonFile(pkgJsonPath);
}
