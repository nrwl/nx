import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  project: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
}
