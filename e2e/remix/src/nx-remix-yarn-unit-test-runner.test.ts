import { runCLI, uniq } from '@nx/e2e-utils';
import {
  setupNxRemixTestYarn,
  cleanupNxRemixTest,
} from './nx-remix-setup-yarn';

describe('Remix E2E Tests', () => {
  describe('--integrated (yarn)', () => {
    beforeAll(async () => {
      setupNxRemixTestYarn();
    });

    afterAll(() => {
      cleanupNxRemixTest();
    });

    describe('--unitTestRunner', () => {
      it('should generate a library with vitest and test correctly', async () => {
        const plugin = uniq('remix');
        runCLI(
          `generate @nx/remix:library ${plugin} --unitTestRunner=vitest --linter=eslint`
        );

        const result = runCLI(`test ${plugin}`);
        expect(result).toContain(`Successfully ran target test`);
      }, 120_000);

      it('should generate a library with jest and test correctly', async () => {
        const reactapp = uniq('react');
        runCLI(
          `generate @nx/react:application ${reactapp} --unitTestRunner=jest --linter=eslint`
        );
        const plugin = uniq('remix');
        runCLI(
          `generate @nx/remix:application ${plugin} --unitTestRunner=jest --linter=eslint`
        );

        const result = runCLI(`test ${plugin}`);
        expect(result).toContain(`Successfully ran target test`);

        const reactResult = runCLI(`test ${reactapp}`);
        expect(reactResult).toContain(`Successfully ran target test`);
      }, 120_000);
    });
  });
});
