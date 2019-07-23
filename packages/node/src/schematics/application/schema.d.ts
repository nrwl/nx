export interface Schema {
  name: string;
  skipFormat: boolean;
  skipPackageJson: boolean;
  directory?: string;
  unitTestRunner: 'jest' | 'none';
  linter: 'eslint' | 'tslint';
  tags?: string;
  frontendProject?: string;
}
