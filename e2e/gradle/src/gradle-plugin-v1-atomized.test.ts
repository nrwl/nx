import { runCLI, updateJson } from '@nx/e2e-utils';
import {
  setupGradlePluginV1Test,
  cleanupGradlePluginV1Test,
} from './gradle-plugin-v1-setup';

describe('Gradle Plugin V1 - Atomized Tests', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      beforeAll(() => {
        setupGradlePluginV1Test(type);
      });

      afterAll(() => cleanupGradlePluginV1Test());

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
});
