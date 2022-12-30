export interface PackageDependency {
  version?: string;
  rootVersion?: boolean;
  packageMeta: any[];
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  name?: string;
  [key: string]: any;
}

export type PackageVersions = Record<string, PackageDependency>;

export type LockFileData = {
  dependencies: Record<string, PackageVersions>;
  lockFileMetadata?: Record<string, any>;
  hash: string;
};
