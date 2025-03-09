import type {
  FileReplacement,
  InlineStyleExtension,
  StylePreprocessorOptions,
} from '@nx/angular-rspack-compiler';

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
  inlineStylesExtension: InlineStyleExtension;
  tsConfig: string;
  hasServer: boolean;
  skipTypeChecking: boolean;
  useTsProjectReferences?: boolean;
  stylePreprocessorOptions?: StylePreprocessorOptions;
}
