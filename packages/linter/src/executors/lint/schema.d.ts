export interface Schema {
  linter: 'eslint' | 'tslint';
  config: string;
  tsConfig?: string | string[];
  format: Formatter;
  exclude: string[];
  files: string[];
  force?: boolean;
  silent?: boolean;
  fix?: boolean;
  cache?: boolean;
  outputFile?: string;
  cacheLocation?: string;
  maxWarnings: number;
  quiet?: boolean;
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
