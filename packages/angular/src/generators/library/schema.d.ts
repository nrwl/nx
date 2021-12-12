import { UnitTestRunner } from '../../utils/test-runners';
import { Linter } from '@nrwl/linter';

export interface Schema {
  name: string;
  skipFormat: boolean;
  simpleModuleName: boolean;
  addModuleSpec?: boolean;
  directory?: string;
  sourceDir?: string;
  buildable: boolean;
  publishable: boolean;
  importPath?: string;
  standaloneConfig?: boolean;

  spec?: boolean;
  flat?: boolean;
  commonModule?: boolean;

  prefix?: string;
  routing?: boolean;
  lazy?: boolean;
  parentModule?: string;
  tags?: string;
  strict?: boolean;

  linter: Exclude<Linter, Linter.TsLint>;
  unitTestRunner: UnitTestRunner;
  compilationMode?: 'full' | 'partial';
  setParserOptionsProject?: boolean;
}
