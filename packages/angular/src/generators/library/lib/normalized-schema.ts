import { UnitTestRunner } from '../../../utils/test-runners';
import type { AngularLinter, Schema } from '../schema';

export interface NormalizedSchema extends Schema {
  linter: AngularLinter;
  unitTestRunner: UnitTestRunner;
  prefix: string;
  fileName: string;
  projectRoot: string;
  entryFile: string;
  modulePath: string;
  moduleName: string;
  projectDirectory: string;
  parsedTags: string[];
  ngCliSchematicLibRoot: string;
}
