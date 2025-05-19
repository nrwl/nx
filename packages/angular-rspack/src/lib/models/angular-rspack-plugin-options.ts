import type {
  FileReplacement,
  InlineStyleLanguage,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';
import type { BudgetEntry } from '@angular/build/private';
import { I18nProjectMetadata } from './i18n';

export interface DevServerOptions {
  /**
   * The hosts that the development server will respond to.
   */
  allowedHosts?: string[] | boolean;
  /**
   * Don't verify connected clients are part of allowed hosts.
   */
  disableHostCheck?: boolean;
  /**
   * Custom HTTP headers to be added to all responses.
   */
  headers?: Record<string, string>;
  /**
   * Enable hot module replacement.
   */
  hmr?: boolean;
  /**
   * Host to listen on.
   */
  host?: string;
  /**
   * @deprecated This is a no-op and can be safely removed.
   * The `inspect` option is no longer supported.
   */
  inspect?: string | boolean;
  /**
   * Whether to reload the page on change, using live-reload.
   * @default true
   */
  liveReload?: boolean;
  /**
   * Opens the url in default browser.
   */
  open?: boolean;
  /**
   * Port to listen on.
   */
  port?: number;
  /**
   * @deprecated This is a no-op and can be safely removed.
   * The `prebundle` option is no longer supported.
   */
  prebundle?:
    | boolean
    | {
        exclude: string[];
      };
  /**
   * Proxy configuration file. For more information, see https://angular.dev/tools/cli/serve#proxying-to-a-backend-server.
   */
  proxyConfig?: string;
  /**
   * The URL that the browser client (or live-reload client, if enabled) should
   * use to connect to the development server. Use for a complex dev server setup,
   * such as one with reverse proxies.
   */
  publicHost?: string;
  /**
   * The pathname where the application will be served.
   */
  servePath?: string;
  /**
   * Serve using HTTPS.
   */
  ssl?: boolean;
  /**
   * SSL certificate to use for serving HTTPS.
   */
  sslCert?: string;
  /**
   * SSL key to use for serving HTTPS.
   */
  sslKey?: string;
}

export interface NormalizedDevServerOptions extends DevServerOptions {
  allowedHosts: string[] | boolean;
  host: string;
  liveReload: boolean;
  port: number;
  open: boolean;
}

export interface OptimizationOptions {
  fonts?:
    | boolean
    | {
        inline?: boolean;
      };
  scripts?: boolean;
  styles?:
    | boolean
    | {
        minify?: boolean;
        inlineCritical?: boolean;
      };
}

export interface NormalizedOptimizationOptions {
  fonts: {
    inline: boolean;
  };
  scripts: boolean;
  styles: {
    minify: boolean;
    inlineCritical: boolean;
  };
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
  | IndexExpandedDefinition & {
      transformer: IndexHtmlTransform | undefined;
    };

export type NormalizedEntryPoint = Required<
  Exclude<ScriptOrStyleEntry, string>
>;

export interface SourceMap {
  scripts: boolean;
  styles: boolean;
  hidden: boolean;
  vendor: boolean;
}

type PatchedBudgetType =
  | 'all'
  | 'allScript'
  | 'any'
  | 'anyScript'
  | 'anyComponentStyle'
  | 'bundle'
  | 'initial';

type PatchedBudgetEntry = Omit<BudgetEntry, 'type'> & {
  type: PatchedBudgetType;
};

export interface AngularRspackPluginOptions {
  /**
   * @deprecated This is a no-op and can be safely removed.
   * A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow all.
   */
  allowedCommonJsDependencies?: string[];
  /**
   *
   */
  appShell?: boolean;
  aot?: boolean;
  assets?: AssetElement[];
  /**
   * Base url for the application being built.
   */
  baseHref?: string;
  browser?: string;
  /**
   * Budget thresholds to ensure parts of your application stay within boundaries which you set.
   */
  budgets?: PatchedBudgetEntry[];
  commonChunk?: boolean;
  /**
   * Define the `crossorigin` attribute setting of elements that provide CORS
   * support.
   * @default 'none'
   */
  crossOrigin?: 'none' | 'anonymous' | 'use-credentials';
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
  /**
   * Customize the base path for the URLs of resources in 'index.html' and
   * component stylesheets. This option is only necessary for specific
   * deployment scenarios, such as with Angular Elements or when utilizing
   * different CDN locations.
   */
  deployUrl?: string;
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
  /**
   * Enable and define the file watching poll time period in milliseconds.
   */
  poll?: number;
  polyfills?: string[];
  /**
   * Prerender (SSG) pages of your application during build time.
   */
  prerender?:
    | boolean
    | {
        /**
         * The routes to render.
         */
        routes?: string[];
        /**
         * The path to a file that contains a list of all routes to prerender, separated by newlines. This option is useful if you want to prerender routes with parameterized URLs.
         */
        routesFile?: string;
        /**
         * Whether the builder should process the Angular Router configuration to find all unparameterized routes and prerender them.
         */
        discoverRoutes?: boolean;
      };
  /**
   * Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set.
   */
  preserveSymlinks?: boolean;
  /**
   * Log progress to the console while building.
   */
  progress?: boolean;
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
  /**
   * Generates a 'stats.json' file which can be analyzed using tools such as 'webpack-bundle-analyzer'.
   */
  statsJson?: boolean;
  stylePreprocessorOptions?: StylePreprocessorOptions;
  styles?: ScriptOrStyleEntry[];
  /**
   * Enables the use of subresource integrity validation.
   * @default false
   */
  subresourceIntegrity?: boolean;
  tsConfig?: string;
  useTsProjectReferences?: boolean;
  vendorChunk?: boolean;
  /**
   * Adds more details to output logging.
   */
  verbose?: boolean;
  /**
   * Run build when files change.
   */
  watch?: boolean;
  /**
   * @deprecated This is a no-op and can be safely removed.
   * The tsconfig file for web workers.
   */
  webWorkerTsConfig?: string;
}

export interface NormalizedAngularRspackPluginOptions
  extends Omit<AngularRspackPluginOptions, 'index' | 'scripts' | 'styles'> {
  appShell: boolean;
  advancedOptimizations: boolean;
  aot: boolean;
  assets: NormalizedAssetElement[];
  browser: string;
  budgets: BudgetEntry[];
  commonChunk: boolean;
  crossOrigin: 'none' | 'anonymous' | 'use-credentials';
  deleteOutputPath: boolean;
  devServer: NormalizedDevServerOptions;
  externalDependencies: string[];
  extractLicenses: boolean;
  fileReplacements: FileReplacement[];
  globalScripts: GlobalEntry[];
  globalStyles: GlobalEntry[];
  hasServer: boolean;
  index: NormalizedIndexElement;
  inlineStyleLanguage: InlineStyleLanguage;
  namedChunks: boolean;
  optimization: NormalizedOptimizationOptions;
  outputHashing: OutputHashing;
  outputPath: OutputPath;
  polyfills: string[];
  projectName: string | undefined;
  progress: boolean;
  root: string;
  scripts: ScriptOrStyleEntry[];
  styles: ScriptOrStyleEntry[];
  sourceMap: SourceMap;
  subresourceIntegrity: boolean;
  supportedBrowsers: string[];
  tsConfig: string;
  vendorChunk: boolean;
  watch: boolean;
}
