import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  directory?: string;
  importPath: string;
  skipTsConfig: boolean;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
}

export interface NormalizedSchema extends Schema {
  name: string;
  fileName: string;
  projectRoot: Path;
  projectDirectory: string;
  parsedTags: string[];
  npmScope: string;
  npmPackageName: string;
  fileTemplate: string;
}
