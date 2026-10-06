import type { LinterType } from '@nx/js';
import { SupportedStyles } from '@nx/react';

export interface NxRemixGeneratorSchema {
  directory: string;
  name?: string;
  style: SupportedStyles;
  tags?: string;
  importPath?: string;
  /** @deprecated Use bundler instead. */
  buildable?: boolean;
  bundler?: 'none' | 'vite' | 'rollup';
  linter?: LinterType;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  js?: boolean;
  skipFormat?: boolean;
  addPlugin?: boolean;
  useProjectJson?: boolean;
}
