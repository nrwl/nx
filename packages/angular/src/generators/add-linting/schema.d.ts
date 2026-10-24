import type { LinterType } from '@nx/js';

export interface AddLintingGeneratorSchema {
  linter?: LinterType;
  projectName: string;
  projectRoot: string;
  prefix: string;
  enableTypedLinting?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: string;
}
