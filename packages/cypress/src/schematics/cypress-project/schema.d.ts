import { Linter } from '@nrwl/workspace';

export interface Schema {
  project: string;
  name: string;
  directory: string;
  linter: Linter;
  js?: boolean;
}
