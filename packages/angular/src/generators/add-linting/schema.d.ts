export interface AddLintingGeneratorSchema {
  projectName: string;
  projectRoot: string;
  prefix: string;
  enableTypedLinting?: boolean;
  /**
   * @deprecated Use `enableTypedLinting` instead. This option will be removed in Nx v24.
   */
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: string;
  addPlugin?: boolean;
}
