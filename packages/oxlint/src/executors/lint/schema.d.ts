export interface OxlintExecutorSchema {
  lintFilePatterns: string[];
  config?: string;
  fix?: boolean;
  fixSuggestions?: boolean;
  fixDangerously?: boolean;
  quiet?: boolean;
  maxWarnings?: number;
  format?: string;
  denyWarnings?: boolean;
  silent?: boolean;
  tsconfig?: string;
  experimentalNestedConfig?: boolean;
}
