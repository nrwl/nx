import { runCLI } from '@nx/e2e-utils';

import {
  configureAtomizedTests,
  createGradleSuiteContext,
  setupGradleSuite,
} from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle atomized tests - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type);

    setupGradleSuite(context);

    it('should run atomized test target', () => {
      configureAtomizedTests();

      expect(() => {
        runCLI('run app:test-ci--MessageUtilsTest', { verbose: true });
        runCLI('run list:test-ci--LinkedListTest', { verbose: true });
      }).not.toThrow();
    });
  }
);
