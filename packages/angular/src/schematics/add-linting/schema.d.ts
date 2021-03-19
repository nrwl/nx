import { Linter } from '@nrwl/workspace';

export interface Schema {
  projectName: string;
  projectType: 'application' | 'library';
  projectRoot: string;
  prefix: string;
  linter: Linter;
}
