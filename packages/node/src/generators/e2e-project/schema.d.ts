export interface Schema {
  project: string;
  projectType: 'server' | 'cli';
  directory?: string;
  name?: string;
  port?: number;
  linter?: 'eslint' | 'none';
  rootProject?: boolean;
  isNest?: boolean;
  skipFormat?: boolean;
}
