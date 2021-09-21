import type {
  CustomTransformerFactory,
  Node,
  Program,
  TransformerFactory,
} from 'typescript';
import { InspectType } from '@nrwl/node/src/executors/execute/execute.impl';

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

type Transformer = TransformerFactory<Node> | CustomTransformerFactory;

export interface TsPlugin {
  name: string;
  options: Record<string, unknown>;
}

export type TsPluginEntry = string | TsPlugin;

export interface CompilerPlugin {
  before?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => Transformer;
  after?: (options?: Record<string, unknown>, program?: Program) => Transformer;
  afterDeclarations?: (
    options?: Record<string, unknown>,
    program?: Program
  ) => Transformer;
}

export interface CompilerPluginHooks {
  beforeHooks: Array<(program?: Program) => Transformer>;
  afterHooks: Array<(program?: Program) => Transformer>;
  afterDeclarationsHooks: Array<(program?: Program) => Transformer>;
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

  additionalEntryPoints?: AdditionalEntryPoint[];
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

export interface NodeExecuteBuilderOptions {
  inspect: boolean | InspectType;
  runtimeArgs: string[];
  args: string[];
  waitUntilTargets: string[];
  buildTarget: string;
  host: string;
  port: number;
  watch: boolean;
  emitSubprocessEvents: boolean;
}
