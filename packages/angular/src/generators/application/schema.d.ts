import { Linter } from '@nx/linter';
import { E2eTestRunner, UnitTestRunner } from '../../utils/test-runners';
import type { Styles } from '../utils/types';

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
  linter?: Linter;
  unitTestRunner?: UnitTestRunner;
  e2eTestRunner?: E2eTestRunner;
  backendProject?: string;
  strict?: boolean;
  standaloneConfig?: boolean;
  port?: number;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  standalone?: boolean;
  rootProject?: boolean;
  minimal?: boolean;
  bundler?: 'webpack' | 'esbuild';
}
