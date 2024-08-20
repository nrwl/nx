import type { ProjectNameAndRootFormat } from '@nx/devkit/src/generators/project-name-and-root-utils';
import type { Linter, LinterType } from '@nx/eslint';

export interface ApplicationGeneratorOptions {
  name: string;
  directory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
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
}

interface NormalizedOptions extends ApplicationGeneratorOptions {
  appProjectName: string;
  appProjectRoot: Path;
}
