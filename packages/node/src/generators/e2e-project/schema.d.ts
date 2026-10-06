export interface Schema {
  project: string;
  projectType: 'server' | 'cli';
  directory?: string;
  name?: string;
  port?: number;
  linter?: 'eslint' | 'oxlint' | 'none';
  rootProject?: boolean;
  isNest?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
