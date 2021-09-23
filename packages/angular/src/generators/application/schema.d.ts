import { Linter } from '@nrwl/linter';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  name: string;
  skipFormat: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
  linter: Exclude<Linter, Linter.TsLint>;
  unitTestRunner: UnitTestRunner;
  e2eTestRunner: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  standaloneConfig?: boolean;
  mfe?: boolean;
  mfeType?: 'host' | 'remote';
  remotes?: string[];
  port?: number;
  host?: string;
  setParserOptionsProject?: boolean;
}
