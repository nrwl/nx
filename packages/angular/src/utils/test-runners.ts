export enum UnitTestRunner {
  Karma = 'karma',
  Jest = 'jest',
  None = 'none',
}
export enum E2eTestRunner {
  /**
   * @deprecated Protractor is no longer maintained. Support for generating
   * E2E tests with it will be removed in v15.
   */
  Protractor = 'protractor',
  Cypress = 'cypress',
  None = 'none',
}
