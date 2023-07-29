import type { Linter } from '@nx/linter';

export interface CreatePackageSchema {
  name: string;
  project: string;

  // options to create cli package, passed to js library generator
  directory?: string;
  skipFormat: boolean;
  tags?: string;
  unitTestRunner: 'jest' | 'none';
  linter: Linter;
  compiler: 'swc' | 'tsc';

  // options to create e2e project, passed to e2e project generator
  e2eProject?: string;
}
