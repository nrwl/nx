import { JsonObject } from '@angular-devkit/core';

export interface NodePackageBuilderOptions extends JsonObject {
  main: string;
  tsConfig: string;
  outputPath: string;
  watch: boolean;
  sourceMap: boolean;
  assets: Array<AssetGlob | string>;
  packageJson: string;
  updateBuildableProjectDepsInPackageJson?: boolean;
  srcRootForCompilationRoot?: string;
}

export interface NormalizedBuilderOptions extends NodePackageBuilderOptions {
  files: Array<FileInputOutput>;
  normalizedOutputPath: string;
  relativeMainFileOutput: string;
}

export type FileInputOutput = {
  input: string;
  output: string;
};
export type AssetGlob = FileInputOutput & {
  glob: string;
  ignore: string[];
};
