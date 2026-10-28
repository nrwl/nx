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
  useProjectJson?: boolean;
  /** Name of the app's build target. Defaults to `build`. */
  buildTarget?: string;
  testRunner?: 'jest' | 'vitest';
}
