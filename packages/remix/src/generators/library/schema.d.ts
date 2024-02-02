import { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { SupportedStyles } from '@nx/react';

export interface NxRemixGeneratorSchema {
  name: string;
  style: SupportedStyles;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  tags?: string;
  importPath?: string;
  buildable?: boolean;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  js?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}
