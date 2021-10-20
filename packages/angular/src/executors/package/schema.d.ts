export interface BuildAngularLibraryExecutorOptions {
  project: string;
  tsConfig?: string;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  updateBuildableProjectDepsInPackageJson?: boolean;
  watch?: boolean;
  fileReplacements?: { replace: string; with: string }[];
}
