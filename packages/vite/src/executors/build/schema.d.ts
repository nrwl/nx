import type { FileReplacement } from '../../plugins/rollup-replace-files.plugin';
export interface ViteBuildExecutorOptions {
  outputPath?: string;
  skipTypeCheck?: boolean;
  configFile?: string;
  fileReplacements?: FileReplacement[];
  watch?: boolean;
  generatePackageJson?: boolean;
  includeDevDependenciesInPackageJson?: boolean;
  buildLibsFromSource?: boolean;
}
