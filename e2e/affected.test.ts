import {
  ensureProject,
  readFile,
  readJson,
  runCommand,
  uniq,
  updateFile,
  runCLI,
  forEachCli,
  supportUi
} from './utils';

let originalCIValue: any;

forEachCli(() => {
  /**
   * Setting CI=true makes it simpler to configure assertions around output, as there
   * won't be any colors.
   */
  beforeAll(() => {
    originalCIValue = process.env.CI;
    process.env.CI = 'true';
  });
  afterAll(() => {
    process.env.CI = originalCIValue;
  });

  describe('Affected', () => {
    it('should print, build, and test affected apps', () => {
      ensureProject();
      const myapp = uniq('myapp');
      const myapp2 = uniq('myapp2');
      const mylib = uniq('mylib');
      const mylib2 = uniq('mylib2');
      const mypublishablelib = uniq('mypublishablelib');
      runCLI(`generate @nrwl/angular:app ${myapp}`);
      runCLI(`generate @nrwl/angular:app ${myapp2}`);
      runCLI(`generate @nrwl/angular:lib ${mylib}`);
      runCLI(`generate @nrwl/angular:lib ${mylib2}`);
      runCLI(`generate @nrwl/angular:lib ${mypublishablelib} --publishable`);

      updateFile(
        `apps/${myapp}/src/app/app.component.spec.ts`,
        `
              import '@proj/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );
      updateFile(
        `libs/${mypublishablelib}/src/lib/${mypublishablelib}.module.spec.ts`,
        `
              import '@proj/${mylib}';
              describe('sample test', () => {
                it('should test', () => {
                  expect(1).toEqual(1);
                });
              });
            `
      );
      expect(
        runCommand(
          `npm run affected:apps -- --files="libs/${mylib}/src/index.ts" --plain`
        ).split('\n')[4]
      ).toEqual(myapp);

      const affectedApps = runCommand(
        `npm run affected:apps -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedApps).toContain(myapp);
      expect(affectedApps).not.toContain(myapp2);
      expect(affectedApps).not.toContain(`${myapp}-e2e`);

      const implicitlyAffectedApps = runCommand(
        'npm run affected:apps -- --files="package.json"'
      );
      expect(implicitlyAffectedApps).toContain(myapp);
      expect(implicitlyAffectedApps).toContain(myapp2);

      const noAffectedApps = runCommand(
        'npm run affected:apps -- --files="README.md"'
      );
      expect(noAffectedApps).not.toContain(myapp);
      expect(noAffectedApps).not.toContain(myapp2);

      expect(
        runCommand(
          `npm run affected:libs -- --files="libs/${mylib}/src/index.ts" --plain`
        ).split('\n')[4]
      ).toEqual(`${mylib} ${mypublishablelib}`);

      const affectedLibs = runCommand(
        `npm run affected:libs -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(affectedLibs).toContain(mypublishablelib);
      expect(affectedLibs).toContain(mylib);
      expect(affectedLibs).not.toContain(mylib2);

      const implicitlyAffectedLibs = runCommand(
        'npm run affected:libs -- --files="package.json"'
      );
      expect(implicitlyAffectedLibs).toContain(mypublishablelib);
      expect(implicitlyAffectedLibs).toContain(mylib);
      expect(implicitlyAffectedLibs).toContain(mylib2);

      const noAffectedLibs = runCommand(
        'npm run affected:libs -- --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain(mypublishablelib);
      expect(noAffectedLibs).not.toContain(mylib);
      expect(noAffectedLibs).not.toContain(mylib2);

      const build = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(build).toContain(`Running target build for projects:`);

      expect(build).toContain(`- ${myapp}`);
      expect(build).toContain(`- ${mypublishablelib}`);
      expect(build).not.toContain('is not registered with the build command');
      expect(build).not.toContain('with flags:');

      // Should work in parallel
      const buildParallel = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --parallel`
      );
      expect(buildParallel).toContain(`Running target build for projects:`);
      expect(buildParallel).toContain(`- ${myapp}`);
      expect(buildParallel).toContain(`- ${mypublishablelib}`);
      expect(buildParallel).toContain('Running target "build" succeeded');

      const buildExcluded = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --exclude ${myapp}`
      );
      expect(buildExcluded).toContain(`Running target build for projects:`);
      expect(buildExcluded).toContain(`- ${mypublishablelib}`);

      // affected:build should pass non-nx flags to the CLI
      const buildWithFlags = runCommand(
        `npm run affected:build -- --files="libs/${mylib}/src/index.ts" -- --stats-json`
      );

      expect(buildWithFlags).toContain(`Running target build for projects:`);
      expect(buildWithFlags).toContain(`- ${myapp}`);
      expect(buildWithFlags).toContain(`- ${mypublishablelib}`);
      expect(buildWithFlags).toContain('With flags:');
      expect(buildWithFlags).toContain('--stats-json=true');

      if (supportUi()) {
        const e2e = runCommand(
          `npm run affected:e2e -- --files="libs/${mylib}/src/index.ts" --headless`
        );
        expect(e2e).toContain('should display welcome message');
      }

      const unitTests = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(unitTests).toContain(`Running target test for projects:`);
      expect(unitTests).toContain(`- ${mylib}`);
      expect(unitTests).toContain(`- ${myapp}`);
      expect(unitTests).toContain(`- ${mypublishablelib}`);
      // Fail a Unit Test
      updateFile(
        `apps/${myapp}/src/app/app.component.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
          '.toEqual(1)',
          '.toEqual(2)'
        )
      );

      const failedTests = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(failedTests).toContain(`Running target test for projects:`);
      expect(failedTests).toContain(`- ${mylib}`);
      expect(failedTests).toContain(`- ${myapp}`);
      expect(failedTests).toContain(`- ${mypublishablelib}`);
      expect(failedTests).toContain(`Failed projects:`);
      expect(failedTests).toContain(
        'You can isolate the above projects by passing: --only-failed'
      );
      expect(readJson('dist/.nx-results')).toEqual({
        command: 'test',
        results: {
          [myapp]: false,
          [mylib]: true,
          [mypublishablelib]: true
        }
      });

      // Fix failing Unit Test
      updateFile(
        `apps/${myapp}/src/app/app.component.spec.ts`,
        readFile(`apps/${myapp}/src/app/app.component.spec.ts`).replace(
          '.toEqual(2)',
          '.toEqual(1)'
        )
      );

      const isolatedTests = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts" --only-failed`
      );
      expect(isolatedTests).toContain(`Running target test for projects`);
      expect(isolatedTests).toContain(`- ${myapp}`);

      const linting = runCommand(
        `npm run affected:lint -- --files="libs/${mylib}/src/index.ts"`
      );
      expect(linting).toContain(`Running target lint for projects:`);
      expect(linting).toContain(`- ${mylib}`);
      expect(linting).toContain(`- ${myapp}`);
      expect(linting).toContain(`- ${myapp}-e2e`);
      expect(linting).toContain(`- ${mypublishablelib}`);

      const lintWithJsonFormating = runCommand(
        `npm run affected:lint -- --files="libs/${mylib}/src/index.ts" -- --format json`
      );
      expect(lintWithJsonFormating).toContain('With flags:');
      expect(lintWithJsonFormating).toContain('--format=json');

      const unitTestsExcluded = runCommand(
        `npm run affected:test -- --files="libs/${mylib}/src/index.ts" --exclude=${myapp},${mypublishablelib}`
      );
      expect(unitTestsExcluded).toContain(`Running target test for projects:`);
      expect(unitTestsExcluded).toContain(`- ${mylib}`);

      const i18n = runCommand(
        `npm run affected -- --target extract-i18n --files="libs/${mylib}/src/index.ts"`
      );
      expect(i18n).toContain(`Running target extract-i18n for projects:`);
      expect(i18n).toContain(`- ${myapp}`);

      const interpolatedTests = runCommand(
        `npm run affected -- --target test --files="libs/${mylib}/src/index.ts" -- --jest-config {project.root}/jest.config.js`
      );
      expect(interpolatedTests).toContain(`Running target \"test\" succeeded`);
    }, 1000000);
  });
});
