/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

// TODO: cleanup this file, it's copied as is from Angular CLI.

import { logging } from '@angular-devkit/core';
import { ParsedConfiguration } from '@angular/compiler-cli';
import { ScriptTarget } from 'typescript';
import {
  AssetPatternClass,
  Budget,
  ExtraEntryPoint,
  OptimizationClass,
  SourceMapClass,
} from '../../browser/schema';
import { NormalizedFileReplacement } from '../../utils/normalize-file-replacements';

export interface BuildOptions {
  optimization: OptimizationClass;
  environment?: string;
  outputPath: string;
  resourcesOutputPath?: string;
  aot?: boolean;
  sourceMap: SourceMapClass;
  /** @deprecated use sourceMap instead */
  vendorSourceMap?: boolean;
  /** @deprecated  */
  evalSourceMap?: boolean;
  vendorChunk?: boolean;
  commonChunk?: boolean;
  baseHref?: string;
  deployUrl?: string;
  verbose?: boolean;
  progress?: boolean;
  i18nFile?: string;
  i18nFormat?: string;
  i18nLocale?: string;
  i18nMissingTranslation?: string;
  extractCss?: boolean;
  bundleDependencies?: 'none' | 'all';
  watch?: boolean;
  outputHashing?: string;
  poll?: number;
  app?: string;
  deleteOutputPath?: boolean;
  preserveSymlinks?: boolean;
  extractLicenses?: boolean;
  showCircularDependencies?: boolean;
  buildOptimizer?: boolean;
  namedChunks?: boolean;
  subresourceIntegrity?: boolean;
  serviceWorker?: boolean;
  webWorkerTsConfig?: string;
  skipAppShell?: boolean;
  statsJson: boolean;
  forkTypeChecker: boolean;
  profile?: boolean;
  es5BrowserSupport?: boolean;

  main: string;
  polyfills?: string;
  budgets: Budget[];
  assets: AssetPatternClass[];
  scripts: ExtraEntryPoint[];
  styles: ExtraEntryPoint[];
  stylePreprocessorOptions?: { includePaths: string[] };
  lazyModules: string[];
  platform?: 'browser' | 'server';
  fileReplacements: NormalizedFileReplacement[];
  /** @deprecated use only for compatibility in 8.x; will be removed in 9.0 */
  rebaseRootRelativeCssUrls?: boolean;

  /* Append script target version to filename. */
  esVersionInFileName?: boolean;

  /* When specified it will be used instead of the script target in the tsconfig.json. */
  scriptTargetOverride?: ScriptTarget;
}

export interface WebpackTestOptions extends BuildOptions {
  codeCoverage?: boolean;
  codeCoverageExclude?: string[];
}

export interface WebpackConfigOptions<T = BuildOptions> {
  root: string;
  logger: logging.Logger;
  projectRoot: string;
  sourceRoot?: string;
  buildOptions: T;
  tsConfig: ParsedConfiguration;
  tsConfigPath: string;
  supportES2015: boolean;
}
