export type OxlintOutputFormat = 'default' | 'agent' | 'github' | 'json';

export interface LintExecutorSchema {
  lintFilePatterns?: string[];
  nestedProjectRoots?: string[];
  format?: OxlintOutputFormat;
  args?: string | string[];
  __unparsed__?: string[];
  [forwarded: string]: unknown;
}
