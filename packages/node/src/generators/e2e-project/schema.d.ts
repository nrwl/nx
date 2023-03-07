export interface Schema {
  project: string;
  projectType: 'server' | 'cli';
  directory?: string;
  name?: string;
  port?: number;
  linter?: 'eslint' | 'none';
  formatFile?: boolean;
  rootProject?: boolean;
  isNest?: boolean;
}
