import { runCLI, checkFilesExist, uniq, runCommandAsync } from '@nx/e2e-utils';
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

    describe('error checking', () => {
      const plugin = uniq('remix');

      beforeAll(async () => {
        runCLI(
          `generate @nx/remix:app apps/${plugin} --tags e2etag,e2ePackage --linter=eslint --unitTestRunner=vitest`
        );
      }, 120000);

      it('should check for un-escaped dollar signs in routes', async () => {
        await expect(async () =>
          runCLI(
            `generate @nx/remix:route --path="apps/${plugin}/app/my.route.$withParams.tsx"`
          )
        ).rejects.toThrow();

        runCLI(
          `generate @nx/remix:route --path="apps/${plugin}/app/routes/my.route.\\$withParams.tsx"`
        );

        expect(() =>
          checkFilesExist(`apps/${plugin}/app/routes/my.route.$withParams.tsx`)
        ).not.toThrow();
      }, 120000);

      it('should pass un-escaped dollar signs in routes with skipChecks flag', async () => {
        await runCommandAsync(
          `someWeirdUseCase=route-segment && yarn nx generate @nx/remix:route --path="apps/${plugin}/app/routes/my.route.$someWeirdUseCase.tsx" --force`
        );

        expect(() =>
          checkFilesExist(
            `apps/${plugin}/app/routes/my.route.route-segment.tsx`
          )
        ).not.toThrow();
      }, 120000);

      it('should check for un-escaped dollar signs in resource routes', async () => {
        await expect(async () =>
          runCLI(
            `generate @nx/remix:resource-route --path="apps/${plugin}/app/routes/my.route.$withParams.ts"`
          )
        ).rejects.toThrow();

        runCLI(
          `generate @nx/remix:resource-route --path="apps/${plugin}/app/routes/my.route.\\$withParams.ts"`
        );

        expect(() =>
          checkFilesExist(`apps/${plugin}/app/routes/my.route.$withParams.ts`)
        ).not.toThrow();
      }, 120000);

      it('should pass un-escaped dollar signs in resource routes with skipChecks flag', async () => {
        await runCommandAsync(
          `someWeirdUseCase=route-segment && yarn nx generate @nx/remix:resource-route --path="apps/${plugin}/app/routes/my.route.$someWeirdUseCase.ts" --force`
        );

        expect(() =>
          checkFilesExist(`apps/${plugin}/app/routes/my.route.route-segment.ts`)
        ).not.toThrow();
      }, 120000);
    });
  });
});
