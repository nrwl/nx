import { Linter } from '@nrwl/workspace';

export interface ConvertTSLintToESLintSchema {
  project: string;
  removeTSLintIfNoMoreTSLintTargets: boolean;
}
