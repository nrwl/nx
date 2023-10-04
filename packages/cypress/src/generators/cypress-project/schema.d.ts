import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter } from '@nx/linter';

export interface Schema {
  project?: string;
  baseUrl?: string;
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  linter?: Linter;
  js?: boolean;
  skipFormat?: boolean;
  setParserOptionsProject?: boolean;
  standaloneConfig?: boolean;
  skipPackageJson?: boolean;
  bundler?: 'webpack' | 'vite' | 'none';
}
