import type { Linter, LinterType } from '@nx/eslint';
import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  directory: string;
  name?: string;
  addTailwind?: boolean;
  skipFormat?: boolean;
  inlineStyle?: boolean;
  inlineTemplate?: boolean;
  viewEncapsulation?: 'Emulated' | 'Native' | 'None';
  routing?: boolean;
  prefix?: string;
  style?: Styles;
  skipTests?: boolean;
  tags?: string;
  linter?: Linter | LinterType;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  port?: number;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  standalone?: boolean;
  rootProject?: boolean;
  minimal?: boolean;
  bundler?: 'webpack' | 'esbuild' | 'rspack';
  ssr?: boolean;
  serverRouting?: boolean;
  nxCloudToken?: string;
  addPlugin?: boolean;
  zoneless?: boolean;
}
