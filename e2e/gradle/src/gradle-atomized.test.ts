import { runCLI, updateJson } from '@nx/e2e-utils';
import { setupGradleTest, cleanupGradleTest } from './gradle-setup';

describe('Gradle - Atomized Tests', () => {
  describe.each([{ type: 'kotlin' }, { type: 'groovy' }])(
    '$type',
    ({ type }: { type: 'kotlin' | 'groovy' }) => {
      beforeAll(() => {
        setupGradleTest(type);
      });

      afterAll(() => cleanupGradleTest());

      it('should run atomized test target', () => {
        updateJson('nx.json', (json) => {
          json.plugins.find((p) => p.plugin === '@nx/gradle').options[
            'ciTestTargetName'
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
