export interface AddLintingGeneratorSchema {
  projectName: string;
  projectRoot: string;
  prefix: string;
  enableTypedLinting?: boolean;
  /**
   * @deprecated The `setParserOptionsProject` option is deprecated and will be removed in Nx v24. Use `enableTypedLinting` instead.
   */
  setParserOptionsProject?: boolean;
  skipFormat?: boolean;
  skipPackageJson?: boolean;
  unitTestRunner?: string;
  addPlugin?: boolean;
}
