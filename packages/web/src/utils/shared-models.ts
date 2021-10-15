import { WebBuildExecutorOptions } from '../executors/build/build.impl';
import { FileReplacement } from './normalize';

export interface OptimizationOptions {
  scripts: boolean;
  styles: boolean;
}

export interface BuildBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
  sourceMap?: boolean | 'hidden';
  optimization?: boolean | OptimizationOptions;
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

export interface AssetGlobPattern {
  glob: string;
  input: string;
  output: string;
  ignore?: string[];
}

export type AssetPattern = AssetPatternClass | string;

export interface AssetPatternClass {
  glob: string;
  ignore?: string[];
  input: string;
  output: string;
}

export enum Type {
  All = 'all',
  AllScript = 'allScript',
  Any = 'any',
  AnyComponentStyle = 'anyComponentStyle',
  AnyScript = 'anyScript',
  Bundle = 'bundle',
  Initial = 'initial',
}

export enum CrossOrigin {
  Anonymous = 'anonymous',
  None = 'none',
  UseCredentials = 'use-credentials',
}

export type IndexUnion = IndexObject | string;

export interface IndexObject {
  input: string;
  output?: string;
}

export type Localize = string[] | boolean;

export type OptimizationUnion = boolean | OptimizationClass;

export interface OptimizationClass {
  scripts?: boolean;
  styles?: boolean;
}

export enum OutputHashing {
  All = 'all',
  Bundles = 'bundles',
  Media = 'media',
  None = 'none',
}

export type ExtraEntryPoint = ExtraEntryPointClass | string;

export interface ExtraEntryPointClass {
  bundleName?: string;
  inject?: boolean;
  input: string;
  lazy?: boolean;
}

export type SourceMapUnion = boolean | SourceMapClass;

export interface SourceMapClass {
  hidden?: boolean;
  scripts?: boolean;
  styles?: boolean;
  vendor?: boolean;
}

export interface StylePreprocessorOptions {
  includePaths?: string[];
}

export interface WebpackConfigOptions<T = WebBuildExecutorOptions> {
  root: string;
  projectRoot: string;
  sourceRoot?: string;
  buildOptions: T;
  tsConfig: any;
  tsConfigPath: string;
  supportES2015: boolean;
}
