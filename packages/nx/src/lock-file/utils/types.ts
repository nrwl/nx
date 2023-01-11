import { PackageSnapshot } from '@pnpm/lockfile-types';

export type LockFileGraph = {
  nodes: Map<string, LockFileNode>;
  isValid: boolean;
};

export type LockFileNode = {
  name: string;
  packageName?: string;
  version?: string;
  edgesOut?: Map<string, LockFileEdge>;
  edgesIn?: Set<LockFileEdge>;
  isHoisted: boolean;
};

export type LockFileEdge = {
  name: string;
  versionSpec: string;
  from?: LockFileNode;
  to?: LockFileNode;
  // some optional dependencies might be missing
  // we want to keep track of that to avoid false positives
  optional?: boolean;
  // incoming edges don't have a source
  incoming?: boolean;
  // error type if source or target is missing
  error?: 'MISSING_TARGET' | 'MISSING_SOURCE';
};

// YARN

export type YarnDependency = {
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // classic specific
  resolved?: string;
  integrity?: string;

  // berry specific
  resolution?: string;
  checksum?: string;
  languageName?: string;
  linkType?: 'soft' | 'hard';
};

// NPM

export type NpmDependencyV3 = {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

export type NpmDependencyV1 = {
  version: string;
  resolved: string;
  integrity: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependencyV1>;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
  name?: string;
};

/**
 * Lock file version differences:
 * - v1 has only dependencies
 * - v2 has dependencies and packages for backwards compatibility
 * - v3 has only packages
 */
export type NpmLockFile = {
  name?: string;
  version?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages?: Record<string, NpmDependencyV3>;
  dependencies?: Record<string, NpmDependencyV1>;
};

// PNPM

export type VersionedPackageSnapshot = PackageSnapshot & { version?: string };
