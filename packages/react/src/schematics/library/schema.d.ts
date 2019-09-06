import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  directory?: string;
  style?: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  pascalCaseFiles?: boolean;
  routing?: boolean;
  appProject?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  publishable?: boolean;
}
