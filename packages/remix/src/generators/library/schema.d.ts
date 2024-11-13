import { SupportedStyles } from '@nx/react';

export interface NxRemixGeneratorSchema {
  directory: string;
  name?: string;
  style: SupportedStyles;
  tags?: string;
  importPath?: string;
  buildable?: boolean;
  linter?: 'none' | 'eslint';
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  js?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
}
