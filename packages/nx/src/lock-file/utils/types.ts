import { PackageJson } from '../../utils/package-json';

export type NormalizedPackageJson = Pick<
  PackageJson,
  | 'name'
  | 'version'
  | 'license'
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'peerDependenciesMeta'
  | 'optionalDependencies'
>;

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
  link?: boolean;
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
