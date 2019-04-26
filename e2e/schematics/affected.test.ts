import {
  ensureProject,
  readFile,
  readJson,
  runCommand,
  runsInWSL,
  uniq,
  updateFile,
  runCLI
} from '../utils';

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
    expect(build).toContain(`Running build for ${mypublishablelib}`);
    expect(build).toContain(`Running build for ${myapp}`);
    expect(build).not.toContain('is not registered with the build command');
    expect(build).not.toContain('with flags:');

    // Should work in parallel
    const buildParallel = runCommand(
      `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --parallel`
    );
    expect(buildParallel).toContain(
      `Running build for projects:\n  ${myapp},\n  ${mypublishablelib}`
    );
    expect(buildParallel).toContain(
      'Running build for affected projects succeeded.'
    );

    const buildExcluded = runCommand(
      `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --exclude ${myapp}`
    );
    expect(buildExcluded).toContain(`Running build for ${mypublishablelib}`);

    // affected:build should pass non-nx flags to the CLI
    const buildWithFlags = runCommand(
      `npm run affected:build -- --files="libs/${mylib}/src/index.ts" --stats-json`
    );
    expect(buildWithFlags).toContain(`Running build for ${mypublishablelib}`);
    expect(buildWithFlags).toContain(`Running build for ${myapp}`);
    expect(buildWithFlags).toContain('With flags: --stats-json=true');

    if (!runsInWSL()) {
      // const e2e = runCommand(
      //   `npm run affected:e2e -- --files="libs/${mylib}/src/index.ts" --headless --no-watch`
      // );
      // expect(e2e).toContain('should display welcome message');
    }

    const unitTests = runCommand(
      `npm run affected:test -- --files="libs/${mylib}/src/index.ts"`
    );
    expect(unitTests).toContain(`Running test for ${mylib}`);
    expect(unitTests).toContain(`Running test for ${mypublishablelib}`);
    expect(unitTests).toContain(`Running test for ${myapp}`);

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

    expect(failedTests).toContain(`Running test for ${mylib}`);
    expect(failedTests).toContain(`Running test for ${mypublishablelib}`);
    expect(failedTests).toContain(`Running test for ${myapp}`);
    expect(failedTests).toContain(`Failed projects: ${myapp}`);
    expect(failedTests).toContain(
      'You can isolate the above projects by passing --only-failed'
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
    expect(isolatedTests).toContain(`Running test for ${myapp}`);

    const linting = runCommand(
      `npm run affected:lint -- --files="libs/${mylib}/src/index.ts"`
    );
    expect(linting).toContain(`Running lint for ${mylib}`);
    expect(linting).toContain(`Running lint for ${myapp}`);
    expect(linting).toContain(`Running lint for ${myapp}-e2e`);
    expect(linting).toContain(`Running lint for ${mypublishablelib}`);

    const lintWithJsonFormating = runCommand(
      `npm run affected:lint -- --files="libs/${mylib}/src/index.ts" -- --format json`
    );
    expect(lintWithJsonFormating).toContain('With flags: --format json');

    const unitTestsExcluded = runCommand(
      `npm run affected:test -- --files="libs/${mylib}/src/index.ts" --exclude=${myapp},${mypublishablelib}`
    );
    expect(unitTestsExcluded).toContain(`Running test for ${mylib}`);

    const i18n = runCommand(
      `npm run affected -- --target extract-i18n --files="libs/${mylib}/src/index.ts"`
    );
    expect(i18n).toContain(`Running extract-i18n for ${myapp}`);

    const interpolatedTests = runCommand(
      `npm run affected -- --target test --files="libs/${mylib}/src/index.ts" -- --jest-config {project.root}/jest.config.js`
    );
    expect(interpolatedTests).toContain(
      `Running test for affected projects succeeded.`
    );
  }, 1000000);
});
