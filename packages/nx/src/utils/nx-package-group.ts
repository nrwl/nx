import { readJsonFile } from './fileutils';
import type { NxPackageJson } from './package-json';

/**
 * The first-party Nx package set declared in nx's own
 * `nx-migrations.packageGroup`. Used by `nx report` (to know which
 * package versions to print) and by `nx add` shell completion (to
 * suggest first-party plugins). Auto-updates as new plugins land in
 * the package group — no hand-maintained list.
 */
export function readNxPackageGroup(): string[] {
  const nxPkg = readJsonFile<NxPackageJson>(require.resolve('nx/package.json'));
  return (nxPkg['nx-migrations']?.packageGroup ?? []).map((e) =>
    typeof e === 'string' ? e : e.package
  );
}
