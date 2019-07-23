export interface Schema {
  name: string;
  style?: string;
  skipFormat: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  e2eTestRunner: 'cypress' | 'none';
  linter: 'eslint' | 'tslint';
  pascalCaseFiles?: boolean;
  classComponent?: boolean;
  routing?: boolean;
}
