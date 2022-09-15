/**
 * tarball hosted remotely
 */
export interface TarballResolution {
  type?: undefined;
  tarball: string;
  integrity?: string;
  // needed in some cases to get the auth token
  // sometimes the tarball URL is under a different path
  // and the auth token is specified for the registry only
  registry?: string;
}

/**
 * directory on a file system
 */
export interface DirectoryResolution {
  type: 'directory';
  directory: string;
}

/**
 * Git repository
 */
export interface GitRepositoryResolution {
  type: 'git';
  repo: string;
  commit: string;
}

type LockfileResolution =
  | TarballResolution
  | GitRepositoryResolution
  | DirectoryResolution
  | {
      integrity: string;
    };

interface Package {
  // name and version are only needed
  // for packages that are hosted not in the npm registry
  name?: string;
  version?: string;
  optional?: true;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: {
    [name: string]: string;
  };
  // TODO: the following ones could be replaced by `[key: string]: unknown`
  peerDependenciesMeta?: {
    [name: string]: {
      optional: true;
    };
  };
  id?: string;
  dev?: true | false;
  requiresBuild?: true;
  patched?: true;
  prepare?: true;
  hasBin?: true;
  license?: string;
  transitivePeerDependencies?: string[];
  bundledDependencies?: string[];
  engines?: {
    node: string;
  };
  bin?: Record<string, string>;
  funding?: { url: string; type: string };
  os?: string[];
  cpu?: string[];
  libc?: string[];
  deprecated?: string;
}

interface PnpmProjectSnapshot {
  specifiers: Record<string, string>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependenciesMeta?: Record<
    string,
    { injected?: boolean; node?: string; patch?: string }
  >;
  publishDirectory?: string;
}

export interface PnpmLockFile {
  lockfileVersion: number;
  overrides?: Record<string, string>;
  packages?: Record<string, Package & { resolution: LockfileResolution }>;
  packageExtensionsChecksum?: string;
  patchedDependencies?: Record<string, { path: string; hash: string }>;
  importers: Record<string, PnpmProjectSnapshot>; // access root with '.'
}

export type YarnLockFile = Record<
  string,
  Package & { integrity?: string; resolved?: string }
>;

/**
 * dependencies recursive chain A -> B -> C is mapped to
 * node_modules/A/node_modules/B/node_modules/C in packages
 *
 * requires is standard import
 */
export interface NpmProjectSnapshot {
  version: string;
  resolved: string;
  integrity: string;
  dev?: boolean;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmProjectSnapshot>;
}

export interface NpmLockFile {
  name?: string;
  lockfileVersion: number;
  requires?: boolean;
  // packages contain prefix (and infix) `node_modules/` in their name
  packages?: Record<
    string,
    Package & { integrity?: string; resolved?: string }
  >;
  dependencies?: Record<string, NpmProjectSnapshot>;
}

export type LockFile = PnpmLockFile | YarnLockFile | NpmLockFile;
