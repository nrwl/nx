import type {
  FileReplacement,
  InlineStyleExtension,
  StylePreprocessorOptions,
} from '@ng-rspack/compiler';

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
  jit: boolean;
  inlineStylesExtension: InlineStyleExtension;
  tsconfigPath: string;
  hasServer: boolean;
  skipTypeChecking: boolean;
  useTsProjectReferences?: boolean;
  stylePreprocessorOptions?: StylePreprocessorOptions;
}
