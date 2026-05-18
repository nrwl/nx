import type { Linter, LinterType } from '@nx/eslint';
import type { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

export interface Schema {
  directory: string;
  name?: string;
  bundler?: 'webpack' | 'rspack';
  port?: number;
  remotes?: string[];
  dynamic?: boolean;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  skipPostInstall?: boolean;
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
