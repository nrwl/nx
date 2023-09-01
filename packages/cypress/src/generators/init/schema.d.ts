import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';

export interface Schema {
  skipPackageJson?: boolean;
  skipFormat?: boolean;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
}
