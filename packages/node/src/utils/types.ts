import ts = require('typescript');

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

type Transformer = ts.TransformerFactory<ts.Node> | ts.CustomTransformerFactory;

export interface TsPlugin {
  name: string;
  options: Record<string, unknown>;
}

export type TsPluginEntry = string | TsPlugin;

export interface CompilerPlugin {
  before?: (
    options?: Record<string, unknown>,
    program?: ts.Program
  ) => Transformer;
  after?: (
    options?: Record<string, unknown>,
    program?: ts.Program
  ) => Transformer;
  afterDeclarations?: (
    options?: Record<string, unknown>,
    program?: ts.Program
  ) => Transformer;
}

export interface CompilerPluginHooks {
  beforeHooks: Array<(program?: ts.Program) => Transformer>;
  afterHooks: Array<(program?: ts.Program) => Transformer>;
  afterDeclarationsHooks: Array<(program?: ts.Program) => Transformer>;
}

export interface BuildBuilderOptions {
  main: string;
  outputPath: string;
  tsConfig: string;
  watch?: boolean;
  sourceMap?: boolean | SourceMapOptions;
  optimization?: boolean | OptimizationOptions;
  showCircularDependencies?: boolean;
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

  tsPlugins?: TsPluginEntry[];
}

export interface BuildNodeBuilderOptions extends BuildBuilderOptions {
  optimization?: boolean;
  sourceMap?: boolean;
  externalDependencies: 'all' | 'none' | string[];
  buildLibsFromSource?: boolean;
  generatePackageJson?: boolean;
}

export interface NormalizedBuildNodeBuilderOptions
  extends BuildNodeBuilderOptions {
  webpackConfig: string[];
}
