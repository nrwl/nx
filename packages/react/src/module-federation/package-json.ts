import { joinPathFragments, readJsonFile, workspaceRoot } from '@nrwl/devkit';
import { existsSync } from 'fs';

export function readRootPackageJson(): {
  dependencies?: { [key: string]: string };
  devDependencies?: { [key: string]: string };
} {
  const pkgJsonPath = joinPathFragments(workspaceRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      'NX MFE: Could not find root package.json to determine dependency versions.'
    );
  }

  return readJsonFile(pkgJsonPath);
}
