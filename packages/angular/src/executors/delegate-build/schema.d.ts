export interface DelegateBuildExecutorSchema {
  buildTarget: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
}
