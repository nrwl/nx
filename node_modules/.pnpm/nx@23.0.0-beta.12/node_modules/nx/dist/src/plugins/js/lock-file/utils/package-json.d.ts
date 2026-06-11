import { PackageJson } from '../../../../utils/package-json';
/**
 * Get version of hoisted package if available
 */
export declare function getHoistedPackageVersion(packageName: string): string;
export type NormalizedPackageJson = Pick<PackageJson, 'name' | 'version' | 'license' | 'dependencies' | 'devDependencies' | 'peerDependencies' | 'peerDependenciesMeta' | 'optionalDependencies' | 'packageManager' | 'resolutions' | 'overrides' | 'pnpm'>;
/**
 * Strip off non-pruning related fields from package.json
 */
export declare function normalizePackageJson(packageJson: PackageJson): NormalizedPackageJson;
