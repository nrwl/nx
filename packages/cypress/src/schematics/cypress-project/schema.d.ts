export interface Schema {
  project: string;
  name: string;
  directory: string;
  linter: 'eslint' | 'tslint';
}
