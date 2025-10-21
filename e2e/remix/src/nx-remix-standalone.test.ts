import { runCLI, uniq, updateFile } from '@nx/e2e-utils';
import {
  setupNxRemixTestStandalone,
  cleanupNxRemixTest,
} from './nx-remix-setup-standalone';

describe('Remix E2E Tests', () => {
  describe('--standalone', () => {
    let proj: string;

    beforeAll(() => {
      proj = setupNxRemixTestStandalone();
    });

    afterAll(() => {
      cleanupNxRemixTest();
    });

    it('should create a standalone remix app', async () => {
      const appName = uniq('remix');
      runCLI(
        `generate @nx/remix:preset --name ${appName} --directory=apps/${appName} --verbose`
      );

      // Can import using ~ alias like a normal Remix setup.
      updateFile(`app/foo.ts`, `export const foo = 'foo';`);
      updateFile(
        `app/routes/index.tsx`,
        `
      import { foo } from '~/foo';
      export default function Index() {
        return (
          <h1>{foo}</h1>
        );
      }
    `
      );

      const result = runCLI(`build ${appName}`);
      expect(result).toContain('Successfully ran target build');
    }, 120_000);
  });
});
