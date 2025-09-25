import { runCLI, updateJson } from '@nx/e2e-utils';

import {
  addProjectReportToSettings,
  createGradleSuiteContext,
  setupGradleSuite,
} from './gradle.setup';

describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
  'Gradle Plugin V1 atomized tests - %s',
  ({ type }: { type: 'kotlin' | 'groovy' }) => {
    const context = createGradleSuiteContext(type, { usePluginV1: true });

    setupGradleSuite(context);
    addProjectReportToSettings(
      `settings.gradle${type === 'kotlin' ? '.kts' : ''}`
    );

    it('should run atomized test target', () => {
      updateJson('nx.json', (json) => {
        json.plugins.find((p) => p.plugin === '@nx/gradle/plugin-v1').options[
          'ciTargetName'
        ] = 'test-ci';
        return json;
      });

      expect(() => {
        runCLI('run app:test-ci--MessageUtilsTest', { verbose: true });
        runCLI('run list:test-ci--LinkedListTest', { verbose: true });
      }).not.toThrow();
    });
  }
);
