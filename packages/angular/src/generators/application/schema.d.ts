import { Linter } from '@nrwl/linter';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

type AngularLinter = Exclude<Linter, Linter.TsLint>;

export interface Schema {
  name: string;
  addTailwind?: boolean;
  skipFormat?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  directory?: string;
  tags?: string;
  linter?: AngularLinter;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  standaloneConfig?: boolean;
  mf?: boolean;
  mfType?: 'host' | 'remote';
  remotes?: string[];
  port?: number;
  host?: string;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  skipPostInstall?: boolean;
  federationType?: 'static' | 'dynamic';
}
