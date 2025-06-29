export interface LegacyPostBuildExecutorSchema {
  assets?: Array<
    | string
    | {
        input: string;
        glob: string;
        output: string;
        ignore?: string[];
      }
  >;
  outputPath?: string;
  tsConfig?: string;
  packageRoot?: string;
  addPackageJsonFields?: boolean;
}
