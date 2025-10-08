import { readFile, runCLI, uniq, updateFile } from '@nx/e2e-utils';
import type { NxJsonConfiguration } from '@nx/devkit';
import {
  setupAffectedGraphTest,
  cleanupAffectedGraphTest,
} from './affected-graph-setup';

describe('Nx Affected and Graph Tests', () => {
  let proj: string;

  beforeAll(() => {
    const context = setupAffectedGraphTest();
    proj = context.proj;
  });
  afterAll(() => cleanupAffectedGraphTest());

  describe('affected:*', () => {
    it('should print, build, and test affected apps', async () => {
      process.env.CI = 'true';
      const myapp = uniq('myapp');
      const myapp2 = uniq('myapp2');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');
      runCLI(`generate @nx/web:app apps/${myapp} --unitTestRunner=vitest`);
      runCLI(`generate @nx/web:app apps/${myapp2} --unitTestRunner=vitest`);
      runCLI(`generate @nx/js:lib libs/${mylib}`);
      runCLI(`generate @nx/js:lib libs/${mylib2}`);
      runCLI(
        `generate @nx/js:lib libs/${mypublishablelib} --publishable --importPath=@${proj}/${mypublishablelib} --tags=ui`
      );

      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        `
              import * as x from '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );
      updateFile(
        `libs/${mypublishablelib}/src/lib/${mypublishablelib}.spec.ts`,
        `
              import * as x from '@${proj}/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );

      const affectedProjects = runCLI(
        `show projects --affected --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedProjects).toContain(myapp);
      expect(affectedProjects).not.toContain(myapp2);

      let affectedLibs = runCLI(
        `show projects --affected --files="libs/${mylib}/src/index.ts" --type lib`
      );
      // type lib shows no apps
      expect(affectedLibs).not.toContain(myapp);
      expect(affectedLibs).not.toContain(myapp2);
      expect(affectedLibs).toContain(mylib);

      const implicitlyAffectedApps = runCLI(
        'show projects --affected --files="tsconfig.base.json"'
      );
      expect(implicitlyAffectedApps).toContain(myapp);
      expect(implicitlyAffectedApps).toContain(myapp2);

      const noAffectedApps = runCLI(
        'show projects --affected projects --files="README.md"'
      );
      expect(noAffectedApps).not.toContain(myapp);
      expect(noAffectedApps).not.toContain(myapp2);

      affectedLibs = runCLI(
        `show projects --affected --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedLibs).toContain(mypublishablelib);
      expect(affectedLibs).toContain(mylib);
      expect(affectedLibs).not.toContain(mylib2);

      const implicitlyAffectedLibs = runCLI(
        'show projects --affected --files="tsconfig.base.json"'
      );
      expect(implicitlyAffectedLibs).toContain(mypublishablelib);
      expect(implicitlyAffectedLibs).toContain(mylib);
      expect(implicitlyAffectedLibs).toContain(mylib2);

      const noAffectedLibsNonExistentFile = runCLI(
        'show projects --affected --files="tsconfig.json"'
      );
      expect(noAffectedLibsNonExistentFile).not.toContain(mypublishablelib);
      expect(noAffectedLibsNonExistentFile).not.toContain(mylib);
      expect(noAffectedLibsNonExistentFile).not.toContain(mylib2);

      const noAffectedLibs = runCLI(
        'show projects --affected --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain(mypublishablelib);
      expect(noAffectedLibs).not.toContain(mylib);
      expect(noAffectedLibs).not.toContain(mylib2);

      // build
      const build = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --parallel`
      );
      expect(build).toContain(`Running target build for 3 projects:`);
      expect(build).toContain(`- ${myapp}`);
      expect(build).toContain(`- ${mypublishablelib}`);
      expect(build).not.toContain('is not registered with the build command');
      expect(build).toContain('Successfully ran target build');

      const buildExcluded = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --exclude=${myapp}`
      );
      expect(buildExcluded).toContain(`Running target build for 2 projects:`);
      expect(buildExcluded).toContain(`- ${mypublishablelib}`);

      const buildExcludedByTag = runCLI(
        `affected:build --files="libs/${mylib}/src/index.ts" --exclude=tag:ui`
      );
      expect(buildExcludedByTag).toContain(
        `Running target build for 2 projects:`
      );
      expect(buildExcludedByTag).not.toContain(`- ${mypublishablelib}`);

      // test
      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.element.spec.ts`).replace(
          '.toEqual(1)',
          '.toEqual(2)'
        )
      );

      const failedTests = runCLI(
        `affected:test --files="libs/${mylib}/src/index.ts"`,
        { silenceError: true }
      );
      expect(failedTests).toContain(mylib);
      expect(failedTests).toContain(myapp);
      expect(failedTests).toContain(mypublishablelib);
      expect(failedTests).toContain(`Failed tasks:`);

      // Fix failing Unit Test
      updateFile(
        `apps/${myapp}/src/app/app.element.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.element.spec.ts`).replace(
          '.toEqual(2)',
          '.toEqual(1)'
        )
      );
    }, 1000000);
  });
});
