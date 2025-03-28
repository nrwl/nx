import type { Linter, LinterType } from '@nx/eslint';
import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  directory: string;
  name?: string;
  remotes?: string[];
  dynamic?: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  skipPostInstall?: boolean;
  addTailwind?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  tags?: string;
  linter?: Linter | LinterType;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  standaloneConfig?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  skipFormat?: boolean;
  standalone?: boolean;
  ssr?: boolean;
  serverRouting?: boolean;
  typescriptConfiguration?: boolean;
}
