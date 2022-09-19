export interface PackageDependency {
  version?: string;
  packageMeta: unknown[];
  dependencies?: Record<string, string>;
  dependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  [key: string]: any;
}

export type LockFileData = {
  dependencies: Record<string, PackageDependency>;
  lockFileMetadata?: Record<string, any>;
};
