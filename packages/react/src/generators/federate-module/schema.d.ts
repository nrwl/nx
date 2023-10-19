export interface Schema {
  name: string;
  path: string;
  remote: string;
  remoteDirectory?: string;
  projectNameAndRootFormat?: ProjectNameAndRootFormat;
  e2eTestRunner?: 'cypress' | 'none';
  host?: string;
  linter?: Linter;
  skipFormat?: boolean;
  style?: SupportedStyles;
  unitTestRunner?: 'jest' | 'vitest' | 'none';
}
