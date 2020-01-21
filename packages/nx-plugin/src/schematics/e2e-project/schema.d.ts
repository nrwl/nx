import { Linter } from '@nrwl/workspace';

export interface Schema {
  pluginName: string;
  npmPackageName: string;
  pluginOutputPath: string;
  jestConfig: string;
  tsSpecConfig: string;
}
