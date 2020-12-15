import { Linter } from '@nrwl/workspace';

export interface Schema {
  projectName: string;
  projectRoot: string;
  linter: Linter;
  js: boolean;
}
