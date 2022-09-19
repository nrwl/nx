export interface PackageDependency {
  version?: string;
  packageMeta: unknown[];
  dependencies?: Record<string, string>;
  dependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  [key: string]: any;
}

export type PackageVersions = Record<string, PackageDependency>;

export type LockFileData = {
  dependencies: Record<string, PackageVersions>;
  lockFileMetadata?: Record<string, any>;
};
