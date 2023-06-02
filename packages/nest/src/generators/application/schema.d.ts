import { Linter } from '@nx/linter';

export interface ApplicationGeneratorOptions {
  name: string;
  directory?: string;
  frontendProject?: string;
  linter?: Linter;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  standaloneConfig?: boolean;
  tags?: string;
  unitTestRunner?: 'jest' | 'none';
  e2eTestRunner?: 'jest' | 'none';
  setParserOptionsProject?: boolean;
  rootProject?: boolean;
  strict?: boolean;
}

interface NormalizedOptions extends ApplicationGeneratorOptions {
  appProjectRoot: Path;
}
