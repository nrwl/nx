export type TestFileDirective = 'depends-on' | 'ignore-server-inputs';

/**
 * The test file directives each plugin applies to the atomized targets it
 * creates, keyed by the name Nx records for the plugin in source maps.
 * Cypress component tests share the Cypress plugin but apply neither.
 */
export const testFileDirectiveSupport = {
  '@nx/cypress/plugin': { 'depends-on': true, 'ignore-server-inputs': true },
  '@nx/jest/plugin': { 'depends-on': true, 'ignore-server-inputs': false },
  '@nx/playwright/plugin': {
    'depends-on': true,
    'ignore-server-inputs': true,
  },
  '@nx/vitest': { 'depends-on': false, 'ignore-server-inputs': false },
} as const satisfies Record<string, Record<TestFileDirective, boolean>>;

export type TestFileDirectivePlugin = keyof typeof testFileDirectiveSupport;
