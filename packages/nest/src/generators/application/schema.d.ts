import type { Linter, LinterType } from '@nx/eslint';

export interface ApplicationGeneratorOptions {
  directory: string;
  name?: string;
  frontendProject?: string;
  linter?: Linter | LinterType;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  standaloneConfig?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'jest' | 'none';
  setParserOptionsProject?: boolean;
  rootProject?: boolean;
  strict?: boolean;
  addPlugin?: boolean;
  useTsSolution?: boolean;
  useProjectJson?: boolean;
}

interface NormalizedOptions extends ApplicationGeneratorOptions {
  appProjectName: string;
  appProjectRoot: Path;
}
