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
  /**
   * @deprecated Use the `host` or `remote` generators instead. Support for generating Module Federation applications using the application generator will be removed in an upcoming version.
   */
  mf?: boolean;
  /**
   * @deprecated Use the `host` or `remote` generators instead. Support for generating Module Federation applications using the application generator will be removed in an upcoming version.
   */
  mfType?: 'host' | 'remote';
  /**
   * @deprecated Use the `host` or `remote` generators instead. Support for generating Module Federation applications using the application generator will be removed in an upcoming version.
   */
  remotes?: string[];
  port?: number;
  /**
   * @deprecated Use the `host` or `remote` generators instead. Support for generating Module Federation applications using the application generator will be removed in an upcoming version.
   */
  host?: string;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
  skipPostInstall?: boolean;
  /**
   * @deprecated Use the `host` or `remote` generators instead. Support for generating Module Federation applications using the application generator will be removed in an upcoming version.
   */
  federationType?: 'static' | 'dynamic';
  skipDefaultProject?: boolean;
  standalone?: boolean;
}
