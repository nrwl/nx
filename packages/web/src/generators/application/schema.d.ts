import type { Linter } from '@nx/linter';

export interface Schema {
  name: string;
  prefix?: string;
  style?: string;
  bundler?: 'webpack' | 'none' | 'vite';
  compiler?: 'babel' | 'swc';
  skipFormat?: boolean;
  directory?: string;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  inSourceTests?: boolean;
  e2eTestRunner?: 'cypress' | 'none';
  linter?: Linter;
  standaloneConfig?: boolean;
  setParserOptionsProject?: boolean;
}
