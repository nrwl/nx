import type {
  FileReplacement,
  InlineStyleLanguage,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';
import type {
  DevServerUnsupportedOptions,
  PluginUnsupportedOptions,
} from './unsupported-options';

export interface DevServerOptions extends DevServerUnsupportedOptions {
  host?: string;
  port?: number;
  proxyConfig?: string;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
}
export interface NormalizedDevServerOptions extends DevServerOptions {
  host: string;
  port: number;
}

export interface OptimizationOptions {
  fonts?: boolean;
  scripts?: boolean;
  styles?: boolean;
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
  media: string;
  server: string;
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
  files: string[];
  initial: boolean;
  name: string;
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

export interface AngularRspackPluginOptions extends PluginUnsupportedOptions {
  aot?: boolean;
  assets?: AssetElement[];
  browser?: string;
  commonChunk?: boolean;
  /**
   * Defines global identifiers that will be replaced with a specified constant value when found in any JavaScript or TypeScript code including libraries.
   * The value will be used directly.
   * String values must be put in quotes.
   */
  define?: Record<string, string>;
  devServer?: DevServerOptions;
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  index?: IndexElement;
  inlineStyleLanguage?: InlineStyleLanguage;
  namedChunks?: boolean;
  optimization?: boolean | OptimizationOptions;
  outputHashing?: OutputHashing;
  outputPath?:
    | string
    | (Required<Pick<OutputPath, 'base'>> & Partial<OutputPath>);
  polyfills?: string[];
  root?: string;
  scripts?: ScriptOrStyleEntry[];
  server?: string;
  skipTypeChecking?: boolean;
  sourceMap?: boolean | Partial<SourceMap>;
  ssr?:
    | boolean
    | {
        entry: string;
        experimentalPlatform?: 'node' | 'neutral';
      };
  stylePreprocessorOptions?: StylePreprocessorOptions;
  styles?: ScriptOrStyleEntry[];
  tsConfig?: string;
  useTsProjectReferences?: boolean;
  vendorChunk?: boolean;
}

export interface NormalizedAngularRspackPluginOptions
  extends Omit<AngularRspackPluginOptions, 'index' | 'scripts' | 'styles'> {
  advancedOptimizations: boolean;
  aot: boolean;
  assets: NormalizedAssetElement[];
  browser: string;
  commonChunk: boolean;
  devServer: NormalizedDevServerOptions;
  extractLicenses: boolean;
  fileReplacements: FileReplacement[];
  globalScripts: GlobalEntry[];
  globalStyles: GlobalEntry[];
  index: NormalizedIndexElement | undefined;
  inlineStyleLanguage: InlineStyleLanguage;
  hasServer: boolean;
  namedChunks: boolean;
  optimization: boolean | OptimizationOptions;
  outputHashing: OutputHashing;
  outputPath: OutputPath;
  polyfills: string[];
  root: string;
  sourceMap: SourceMap;
  tsConfig: string;
  vendorChunk: boolean;
}
