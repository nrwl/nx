import { existsSync } from 'fs';
import { requireNx } from '../../../nx';

const { workspaceRoot, readJsonFile, joinPathFragments } = requireNx();

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
