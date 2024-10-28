import type { Linter, LinterType } from '@nx/eslint';

export interface CreatePackageSchema {
  name: string;
  project: string;
  directory: string;

  // options to create cli package, passed to js library generator
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter | LinterType;
  compiler: 'swc' | 'tsc';

  // options to create e2e project, passed to e2e project generator
  e2eProject?: string;
}
