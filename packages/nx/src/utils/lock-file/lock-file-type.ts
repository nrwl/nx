export interface PackageDependency<T> {
  version: string;
  packageMeta: T[];
  dependencies?: Record<string, string>;
  dependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: string }>; // todo: THIS IS FOR YARN 2
  [key: string]: any;
}

export type LockFileData<T = any> = {
  dependencies: Record<string, PackageDependency<T>>;
  lockFileMetadata?: Record<string, any>;
};
