import type { Linter, LinterType } from '@nx/eslint';
import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  directory: string;
  name?: string;
  bundler?: 'webpack' | 'rspack';
  host?: string;
  port?: number;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  addTailwind?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  tags?: string;
  linter?: Linter | LinterType;
  unitTestRunner?: Exclude<UnitTestRunner, UnitTestRunner.VitestAngular>;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  skipFormat?: boolean;
  standalone?: boolean;
  ssr?: boolean;
  zoneless?: boolean;
  typescriptConfiguration?: boolean;
}
