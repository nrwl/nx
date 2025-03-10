import type {
  FileReplacement,
  InlineStyleLanguage,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';

export interface DevServerOptions {
  port: number;
}

export interface OptimizationOptions {
  scripts?: boolean;
  styles?: boolean;
  fonts?: boolean;
}

export interface AngularRspackPluginOptions {
  root: string;
  index: string;
  browser: string;
  server?: string;
  ssrEntry?: string;
  polyfills: string[];
  assets: string[];
  styles: string[];
  scripts: string[];
  fileReplacements: FileReplacement[];
  aot: boolean;
  inlineStyleLanguage: InlineStyleLanguage;
  tsConfig: string;
  hasServer: boolean;
  skipTypeChecking: boolean;
  useTsProjectReferences?: boolean;
  optimization?: boolean | OptimizationOptions;
  stylePreprocessorOptions?: StylePreprocessorOptions;
  devServer?: DevServerOptions;
}
