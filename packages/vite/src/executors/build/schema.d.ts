export interface ViteBuildExecutorOptions {
  buildLibsFromSource?: boolean;
  configFile?: string;
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  outputPath?: string;
  skipPackageManager?: boolean;
  skipTypeCheck?: boolean;
  tsConfig?: string;
  watch?: boolean;
}
