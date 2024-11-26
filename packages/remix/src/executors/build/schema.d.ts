export interface RemixBuildSchema {
  generateLockfile?: boolean;
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  outputPath: string;
  skipPackageManager?: boolean;
  sourcemap?: boolean;
}
