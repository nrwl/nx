import type { PackageJsonUpdateForPackage as PackageUpdate } from '../../config/misc-interfaces';
import type { PackageJson } from '../../utils/package-json';
/**
 * Drop entries from `packageUpdates` that would either downgrade the package
 * (move resolved version backward) or rewrite a specifier that is already
 * exactly pinned to the resolved version (a no-op write). Keep genuine
 * upgrades and narrowing rewrites where the user's range covers a version
 * lower than what's resolved (the migrator's traditional "lock to recommended
 * exact pin" behavior).
 */
export declare function filterDowngradedUpdates(packageUpdates: Record<string, PackageUpdate>, packageJson: PackageJson | null, getInstalledVersion: (packageName: string) => string | null): Record<string, PackageUpdate>;
