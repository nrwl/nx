import {
  cleanupProject,
  killPorts,
  newProject,
  runCLI,
  checkFilesExist,
  readJson,
  uniq,
  updateFile,
  runCommandAsync,
} from '@nx/e2e/utils';

describe('Remix E2E Tests', () => {
  describe('--integrated (npm)', () => {
    beforeAll(() => {
      newProject({
        packages: ['@nx/remix', '@nx/react'],
        packageManager: 'npm',
      });
    });

    afterAll(() => {
      killPorts();
      cleanupProject();
    });

    it('should not cause peer dependency conflicts', async () => {
      const plugin = uniq('remix');
      runCLI(
        `generate @nx/remix:app ${plugin} --linter=eslint --unitTestRunner=vitest`
      );

      await runCommandAsync('npm install');
    }, 120000);
  });
  describe('--integrated (yarn)', () => {
    beforeAll(() => {
      newProject({ packages: ['@nx/remix', '@nx/react'] });
    });

    afterAll(() => {
      killPorts();
      cleanupProject();
    });

    it('should create app', async () => {
      const plugin = uniq('remix');
      runCLI(
        `generate @nx/remix:app ${plugin} --linter=eslint --unitTestRunner=vitest`
      );

      const buildResult = runCLI(`build ${plugin}`);
      expect(buildResult).toContain('Successfully ran target build');

      const testResult = runCLI(`test ${plugin}`);
      expect(testResult).toContain('Successfully ran target test');
    }, 120000);

    describe('--directory', () => {
      it('should create src in the specified directory', async () => {
        const plugin = uniq('remix');
        runCLI(
          `generate @nx/remix:app --name=${plugin} --directory=subdir --rootProject=false --no-interactive --linter=eslint --unitTestRunner=vitest`
        );

        const result = runCLI(`build ${plugin}`);
        expect(result).toContain('Successfully ran target build');
        checkFilesExist(`subdir/build/server/index.js`);
      }, 120000);
    });

    describe('--tags', () => {
      it('should add tags to the project', async () => {
        const plugin = uniq('remix');
        runCLI(
          `generate @nx/remix:app apps/${plugin} --tags e2etag,e2ePackage --linter=eslint --unitTestRunner=vitest`
        );
        const project = readJson(`apps/${plugin}/project.json`);
        expect(project.tags).toEqual(['e2etag', 'e2ePackage']);
      }, 120000);
    });

    describe('--js', () => {
      it('should create js app and build correctly', async () => {
        const plugin = uniq('remix');
        runCLI(
          `generate @nx/remix:app ${plugin} --js=true --linter=eslint --unitTestRunner=vitest`
        );

        const result = runCLI(`build ${plugin}`);
        expect(result).toContain('Successfully ran target build');
      }, 120000);
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

      xit('should pass un-escaped dollar signs in resource routes with skipChecks flag', async () => {
        await runCommandAsync(
          `someWeirdUseCase=route-segment && yarn nx generate @nx/remix:resource-route --path="apps/${plugin}/app/routes/my.route.$someWeirdUseCase.ts" --force`
        );

        expect(() =>
          checkFilesExist(`apps/${plugin}/app/routes/my.route.route-segment.ts`)
        ).not.toThrow();
      }, 120000);
    });
  });

  describe('--standalone', () => {
    let proj: string;

    beforeAll(() => {
      proj = newProject({ packages: ['@nx/remix'] });
    });

    afterAll(() => {
      killPorts();
      cleanupProject();
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
