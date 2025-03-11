import type {
  FileReplacement,
  InlineStyleLanguage,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';

export interface DevServerOptions {
  port?: number;
  ssl?: boolean;
  sslKey?: string;
  sslCert?: string;
  proxyConfig?: string;
}

export interface OptimizationOptions {
  scripts?: boolean;
  styles?: boolean;
  fonts?: boolean;
}

export type OutputHashing = 'none' | 'all' | 'media' | 'bundles';
export type HashFormat = {
  chunk: string;
  extract: string;
  file: string;
  script: string;
};

export interface OutputPath {
  base: string;
  browser: string;
  server: string;
  media: string;
}

export type AssetExpandedDefinition = {
  glob: string;
  input: string;
  ignore?: string[];
  output?: string;
};
export type AssetElement = AssetExpandedDefinition | string;
export type NormalizedAssetElement = AssetExpandedDefinition & {
  output: string;
};
export type ScriptOrStyleEntry =
  | string
  | {
      input: string;
      bundleName?: string;
      inject?: boolean;
    };
export type GlobalEntry = {
  name: string;
  files: string[];
  initial: boolean;
};
export type IndexExpandedDefinition = {
  input: string;
  output?: string;
  preloadInitial?: boolean;
};
export type IndexElement = IndexExpandedDefinition | string | false;
export type IndexHtmlTransform = (content: string) => Promise<string>;
export type NormalizedIndexElement =
  | (IndexExpandedDefinition & {
      insertionOrder: [string, boolean][];
      transformer: IndexHtmlTransform | undefined;
    })
  | false;

export interface SourceMap {
  scripts: boolean;
  styles: boolean;
  hidden: boolean;
  vendor: boolean;
}

export interface AngularRspackPluginOptions {
  index: IndexElement;
  browser: string;
  server?: string;
  ssr?:
    | boolean
    | {
        entry: string;
        experimentalPlatform?: 'node' | 'neutral';
      };
  polyfills: string[];
  assets?: AssetElement[];
  styles?: ScriptOrStyleEntry[];
  scripts?: ScriptOrStyleEntry[];
  outputPath:
    | string
    | (Required<Pick<OutputPath, 'base'>> & Partial<OutputPath>);
  fileReplacements: FileReplacement[];
  aot: boolean;
  inlineStyleLanguage: InlineStyleLanguage;
  tsConfig: string;
  hasServer: boolean;
  sourceMap?: boolean | Partial<SourceMap>;
  skipTypeChecking: boolean;
  useTsProjectReferences?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputHashing?: OutputHashing;
  stylePreprocessorOptions?: StylePreprocessorOptions;
  namedChunks?: boolean;
  vendorChunk?: boolean;
  commonChunk?: boolean;
  devServer?: DevServerOptions;
  extractLicenses?: boolean;
  root?: string;
}

export interface NormalizedAngularRspackPluginOptions
  extends Omit<AngularRspackPluginOptions, 'index' | 'scripts' | 'styles'> {
  advancedOptimizations: boolean;
  assets: NormalizedAssetElement[];
  index: NormalizedIndexElement | undefined;
  devServer: DevServerOptions & { port: number };
  extractLicenses: boolean;
  namedChunks: boolean;
  vendorChunk: boolean;
  commonChunk: boolean;
  globalScripts: GlobalEntry[];
  globalStyles: GlobalEntry[];
  optimization: boolean | OptimizationOptions;
  outputHashing: OutputHashing;
  outputPath: OutputPath;
  root: string;
  sourceMap: SourceMap;
}
