import type {
  CustomTransformerFactory,
  Node,
  Program,
  TransformerFactory as TypescriptTransformerFactory,
} from 'typescript';

export interface FileReplacement {
  replace: string;
  with: string;
}

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

type TransformerFactory =
  | TypescriptTransformerFactory<Node>
  | CustomTransformerFactory;

export interface TransformerPlugin {
  name: string;
  options: Record<string, unknown>;
}

export type TransformerEntry = string | TransformerPlugin;

export interface CompilerPlugin {
  before?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => TransformerFactory;
  after?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => TransformerFactory;
  afterDeclarations?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => TransformerFactory;
}

export interface CompilerPluginHooks {
  beforeHooks: Array<(program?: Program) => TransformerFactory>;
  afterHooks: Array<(program?: Program) => TransformerFactory>;
  afterDeclarationsHooks: Array<(program?: Program) => TransformerFactory>;
}

export interface AdditionalEntryPoint {
  entryName: string;
  entryPath: string;
}

export interface BuildBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
  sourceMap?: boolean | SourceMapOptions;
  optimization?: boolean | OptimizationOptions;
  maxWorkers?: number;
  memoryLimit?: number;
  poll?: number;

  fileReplacements: FileReplacement[];
  assets?: any[];

  progress?: boolean;
  statsJson?: boolean;
  extractLicenses?: boolean;
  verbose?: boolean;

  webpackConfig?: string | string[];

  root?: string;
  sourceRoot?: string;
  projectRoot?: string;

  transformers?: TransformerEntry[];

  additionalEntryPoints?: AdditionalEntryPoint[];
  outputFileName?: string;
}

export interface BuildNodeBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  externalDependencies: 'all' | 'none' | string[];
  buildLibsFromSource?: boolean;
  generatePackageJson?: boolean;
  deleteOutputPath?: boolean;
}

export interface NormalizedBuildNodeBuilderOptions
  extends BuildNodeBuilderOptions {
  webpackConfig: string[];
}
