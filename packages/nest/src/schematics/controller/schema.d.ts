import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  project: string;
  skipFormat: boolean;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  service?: boolean;
}
