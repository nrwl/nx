import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface Schema {
  project: string;
  projectType: 'server' | 'cli';
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  name?: string;
  port?: number;
  linter?: 'eslint' | 'none';
  rootProject?: boolean;
  isNest?: boolean;
  skipFormat?: boolean;
}
