import { Linter } from '@nrwl/workspace';

export interface Schema {
  name: string;
  style?: string;
  server?: string;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  e2eTestRunner: 'cypress' | 'none';
  linter: Linter;
  pascalCaseFiles?: boolean;
  skipWorkspaceJson?: boolean;
  classComponent: boolean;
}
