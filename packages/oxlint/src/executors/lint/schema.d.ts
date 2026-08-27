export type OxlintOutputFormat = 'default' | 'agent' | 'github' | 'json';

export interface LintExecutorSchema {
  lintFilePatterns?: string[];
  format?: OxlintOutputFormat;
  args?: string | string[];
  __unparsed__?: string[];
  /** Any other option is forwarded to Oxlint as a CLI flag. */
  [forwarded: string]: unknown;
}
