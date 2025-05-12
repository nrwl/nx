export interface ViteBuildExecutorOptions {
  buildLibsFromSource?: boolean;
  configFile?: string;
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  outputPath?: string;
  skipOverrides?: boolean;
  skipPackageManager?: boolean;
  skipTypeCheck?: boolean;
  tsConfig?: string;
  watch?: boolean;
  useEnvironmentsApi?: boolean;
}
