import type { LinterType } from '@nx/js';

export interface ApplicationGeneratorOptions {
  directory: string;
  name?: string;
  frontendProject?: string;
  linter?: LinterType;
  formatter?: 'none' | 'prettier' | 'oxfmt';
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
  e2eTestRunner?: 'jest' | 'none';
  bundler?: 'webpack' | 'rolldown';
  enableTypedLinting?: boolean;
  rootProject?: boolean;
  strict?: boolean;
  useTsSolution?: boolean;
  useProjectJson?: boolean;
}

interface NormalizedOptions extends ApplicationGeneratorOptions {
  appProjectName: string;
  appProjectRoot: Path;
}
