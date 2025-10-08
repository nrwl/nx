import { runCLI, uniq, runCommandAsync } from '@nx/e2e-utils';
import { setupNxRemixTestNpm, cleanupNxRemixTest } from './nx-remix-setup-npm';

describe('Remix E2E Tests', () => {
  describe('--integrated (npm)', () => {
    beforeAll(() => {
      setupNxRemixTestNpm();
    });

    afterAll(() => {
      cleanupNxRemixTest();
    });

    it('should not cause peer dependency conflicts', async () => {
      const plugin = uniq('remix');
      runCLI(
        `generate @nx/remix:app ${plugin} --linter=eslint --unitTestRunner=vitest`
      );

      await runCommandAsync('npm install');
    }, 120000);
  });
});
