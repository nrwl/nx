import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  prefix?: string;
  style?: string;
  compiler?: 'babel' | 'swc';
  skipFormat?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'cypress' | 'none';
  linter?: Linter;
  babelJest?: boolean;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
}
