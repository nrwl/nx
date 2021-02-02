import { FileReplacement } from './normalize';

export interface OptimizationOptions {
  scripts: boolean;
  styles: boolean;
}

export interface SourceMapOptions {
  scripts: boolean;
  styles: boolean;
  vendors: boolean;
  hidden: boolean;
}

export interface BuildBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
  sourceMap?: boolean | SourceMapOptions;
  optimization?: boolean | OptimizationOptions;
  showCircularDependencies?: boolean;
  memoryLimit?: number;
  maxWorkers?: number;
  poll?: number;

  fileReplacements?: FileReplacement[];
  assets?: any[];

  progress?: boolean;
  statsJson?: boolean;
  extractLicenses?: boolean;
  verbose?: boolean;

  outputHashing?: any;
  webpackConfig?: string;

  root?: string;
  sourceRoot?: string;
}

export interface Globals {
  moduleId: string;
  global: string;
}

export interface PackageBuilderOptions {
  outputPath: string;
  tsConfig: string;
  project: string;
  entryFile: string;
  extractCss?: boolean;
  globals?: Globals[];
  external?: string[];
  rollupConfig?: string;
  babelConfig?: string;
  watch?: boolean;
  assets?: any[];
  updateBuildableProjectDepsInPackageJson?: boolean;
  buildableProjectDepsInPackageJsonType?: 'dependencies' | 'peerDependencies';
  umdName?: string;
  deleteOutputPath?: boolean;
}

export interface AssetGlobPattern {
  glob: string;
  input: string;
  output: string;
  ignore?: string[];
}
