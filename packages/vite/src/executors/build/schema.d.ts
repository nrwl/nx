export interface ViteBuildExecutorOptions {
  outputPath?: string;
  buildLibsFromSource?: boolean;
  skipTypeCheck?: boolean;
  configFile?: string;
  watch?: boolean;
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  tsConfig?: string;
}
