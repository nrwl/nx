import type {
  FileReplacement,
  InlineStyleLanguage,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';
import type {
  DevServerUnsupportedOptions,
  PluginUnsupportedOptions,
} from './unsupported-options';
import { I18nProjectMetadata } from './i18n';

export interface DevServerOptions extends DevServerUnsupportedOptions {
  /**
   * The hosts that the development server will respond to.
   */
  allowedHosts?: string[] | boolean;
  /**
   * Don't verify connected clients are part of allowed hosts.
   */
  disableHostCheck?: boolean;
  host?: string;
  port?: number;
  proxyConfig?: string;
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
}
export interface NormalizedDevServerOptions extends DevServerOptions {
  allowedHosts: string[] | boolean;
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
  /**
   * Delete the output path before building.
   */
  deleteOutputPath?: boolean;
  devServer?: DevServerOptions;
  /**
   * Exclude the listed external dependencies from being bundled into the bundle. Instead, the created bundle relies on these dependencies to be available during runtime.
   */
  externalDependencies?: string[];
  extractLicenses?: boolean;
  fileReplacements?: FileReplacement[];
  index?: IndexElement;
  inlineStyleLanguage?: InlineStyleLanguage;
  /**
   * Project metadata for i18n.
   */
  i18nMetadata?: I18nProjectMetadata;
  /**
   * How to handle missing translations for i18n.
   */
  i18nMissingTranslation?: 'warning' | 'error' | 'ignore';
  /**
   * How to handle duplicate translations for i18n.
   */
  i18nDuplicateTranslation?: 'warning' | 'error' | 'ignore';
  /**
   * Translate the bundles in one or more locales.
   */
  localize?: boolean | string[];
  namedChunks?: boolean;
  /**
   * Path to ngsw-config.json.
   */
  ngswConfigPath?: string;
  optimization?: boolean | OptimizationOptions;
  outputHashing?: OutputHashing;
  outputPath?:
    | string
    | (Required<Pick<OutputPath, 'base'>> & Partial<OutputPath>);
  polyfills?: string[];
  /**
   * Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set.
   */
  preserveSymlinks?: boolean;
  root?: string;
  scripts?: ScriptOrStyleEntry[];
  server?: string;
  /**
   * Generates a service worker config for production builds.
   */
  serviceWorker?: boolean;
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
  deleteOutputPath: boolean;
  devServer: NormalizedDevServerOptions;
  externalDependencies: string[];
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
