export interface RemixBuildSchema {
  outputPath: string;
  includeDevDependenciesInPackageJson?: boolean;
  generatePackageJson?: boolean;
  generateLockfile?: boolean;
  sourcemap?: boolean;
}
