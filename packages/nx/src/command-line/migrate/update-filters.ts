import { gt, lt, minVersion } from 'semver';
import type { PackageJsonUpdateForPackage as PackageUpdate } from '../../config/misc-interfaces';
import type { PackageJson } from '../../utils/package-json';
import { normalizeVersion } from './version-utils';

/**
 * Drop entries from `packageUpdates` that would either downgrade the package
 * (move resolved version backward) or rewrite a specifier that is already
 * exactly pinned to the resolved version (a no-op write). Keep genuine
 * upgrades and narrowing rewrites where the user's range covers a version
 * lower than what's resolved (the migrator's traditional "lock to recommended
 * exact pin" behavior).
 */
export function filterDowngradedUpdates(
  packageUpdates: Record<string, PackageUpdate>,
  packageJson: PackageJson | null,
  getInstalledVersion: (packageName: string) => string | null
): Record<string, PackageUpdate> {
  const result: Record<string, PackageUpdate> = {};
  for (const [name, update] of Object.entries(packageUpdates)) {
    const resolved = getInstalledVersion(name);
    if (!resolved) {
      // Not installed; let downstream logic decide whether to add it.
      result[name] = update;
      continue;
    }
    const proposed = normalizeVersion(update.version);
    const resolvedNorm = normalizeVersion(resolved);
    if (gt(proposed, resolvedNorm)) {
      result[name] = update;
      continue;
    }
    if (lt(proposed, resolvedNorm)) {
      continue;
    }
    // proposed === resolved: keep when narrowing a looser specifier to an
    // exact pin; drop when the specifier is already exact at resolved.
    const specifier =
      packageJson?.dependencies?.[name] ?? packageJson?.devDependencies?.[name];
    if (!specifier) {
      continue;
    }
    const floor = minVersion(specifier);
    if (floor && lt(floor.version, resolvedNorm)) {
      result[name] = update;
    }
  }
  return result;
}
