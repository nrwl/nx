export interface BuildAngularLibraryExecutorOptions {
  project: string;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  tailwindConfig?: string;
  tsConfig?: string;
  updateBuildableProjectDepsInPackageJson?: boolean;
  watch?: boolean;
}
