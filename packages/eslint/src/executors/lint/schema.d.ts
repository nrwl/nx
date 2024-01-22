import type { JsonObject } from '@angular-devkit/core';
import type { Linter } from 'eslint';

export interface Schema extends JsonObject {
  eslintConfig: string | null;
  lintFilePatterns: string[];
  format: Formatter;
  force: boolean;
  silent: boolean;
  fix: boolean;
  cache: boolean;
  noEslintrc: boolean;
  outputFile: string | null;
  cacheLocation: string | null;
  maxWarnings: number;
  quiet: boolean;
  ignorePath: string | null;
  hasTypeAwareRules: boolean;
  cacheStrategy: 'content' | 'metadata' | null;
  rulesdir: string[];
  resolvePluginsRelativeTo: string | null;
  reportUnusedDisableDirectives: Linter.StringSeverity | null;
  printConfig?: string | null;
  errorOnUnmatchedPattern?: boolean;
}

type Formatter =
  | 'stylish'
  | 'compact'
  | 'codeframe'
  | 'unix'
  | 'visualstudio'
  | 'table'
  | 'checkstyle'
  | 'html'
  | 'jslint-xml'
  | 'json'
  | 'json-with-metadata'
  | 'junit'
  | 'tap';
