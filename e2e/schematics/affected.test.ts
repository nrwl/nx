import {
  newApp,
  newLib,
  newProject,
  readFile,
  readJson,
  runCommand,
  updateFile
} from '../utils';

describe('Affected', () => {
  it(
    'should print, build, and test affected apps',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');
      newLib('mylib2');
      newLib('mypublishablelib --publishable');

      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        `
            import '@proj/mylib';
            describe('sample test', () => {
              it('should test', () => {
                expect(1).toEqual(1);
              });
            });
          `
      );
      updateFile(
        'libs/mypublishablelib/src/lib/mypublishablelib.module.spec.ts',
        `
            import '@proj/mylib';
            describe('sample test', () => {
              it('should test', () => {
                expect(1).toEqual(1);
              });
            });
          `
      );

      const affectedApps = runCommand(
        'npm run affected:apps -- --files="libs/mylib/src/index.ts"'
      );
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).not.toContain('myapp2');
      expect(affectedApps).not.toContain('myapp-e2e');

      const implicitlyAffectedApps = runCommand(
        'npm run affected:apps -- --files="package.json"'
      );
      expect(implicitlyAffectedApps).toContain('myapp');
      expect(implicitlyAffectedApps).toContain('myapp2');

      const noAffectedApps = runCommand(
        'npm run affected:apps -- --files="README.md"'
      );
      expect(noAffectedApps).not.toContain('myapp');
      expect(noAffectedApps).not.toContain('myapp2');

      const affectedLibs = runCommand(
        'npm run affected:libs -- --files="libs/mylib/src/index.ts"'
      );
      expect(affectedLibs).toContain('mypublishablelib');
      expect(affectedLibs).toContain('mylib');
      expect(affectedLibs).not.toContain('mylib2');

      const implicitlyAffectedLibs = runCommand(
        'npm run affected:libs -- --files="package.json"'
      );
      expect(implicitlyAffectedLibs).toContain('mypublishablelib');
      expect(implicitlyAffectedLibs).toContain('mylib');
      expect(implicitlyAffectedLibs).toContain('mylib2');

      const noAffectedLibs = runCommand(
        'npm run affected:libs -- --files="README.md"'
      );
      expect(noAffectedLibs).not.toContain('mypublishablelib');
      expect(noAffectedLibs).not.toContain('mylib');
      expect(noAffectedLibs).not.toContain('mylib2');

      const build = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts"'
      );
      expect(build).toContain('Building mypublishablelib, myapp');
      expect(build).not.toContain('is not registered with the build command');
      expect(build).not.toContain('with flags:');

      // Should work in parallel
      const buildParallel = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --parallel'
      );
      expect(buildParallel).toContain('Building mypublishablelib, myapp');

      const buildExcluded = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --exclude myapp'
      );
      expect(buildExcluded).toContain('Building mypublishablelib');

      const buildExcludedCsv = runCommand(
        'npm run affected:build -- --files="package.json" --exclude myapp,myapp2,mypublishablelib'
      );
      expect(buildExcludedCsv).toContain('No projects to build');

      // affected:build should pass non-nx flags to the CLI
      const buildWithFlags = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --stats-json'
      );
      expect(buildWithFlags).toContain(
        'Building mypublishablelib, myapp with flags: --stats-json=true'
      );

      const e2e = runCommand(
        'npm run affected:e2e -- --files="libs/mylib/src/index.ts"'
      );
      expect(e2e).toContain('should display welcome message');

      const unitTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts"'
      );
      expect(unitTests).toContain('Testing mylib, mypublishablelib, myapp');

      // Fail a Unit Test
      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        readFile('apps/myapp/src/app/app.component.spec.ts').replace(
          '.toEqual(1)',
          '.toEqual(2)'
        )
      );

      const failedTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts"'
      );

      expect(failedTests).toContain('Testing mylib, mypublishablelib, myapp');
      expect(failedTests).toContain('Failed projects: myapp');
      expect(failedTests).toContain(
        'You can isolate the above projects by passing --only-failed'
      );
      expect(readJson('dist/.nx-results')).toEqual({
        command: 'test',
        results: {
          myapp: false,
          mylib: true,
          mypublishablelib: true
        }
      });

      // Fix failing Unit Test
      updateFile(
        'apps/myapp/src/app/app.component.spec.ts',
        readFile('apps/myapp/src/app/app.component.spec.ts').replace(
          '.toEqual(2)',
          '.toEqual(1)'
        )
      );

      const isolatedTests = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts" --only-failed'
      );
      expect(isolatedTests).toContain('Testing myapp');

      const linting = runCommand(
        'npm run affected:lint -- --files="libs/mylib/src/index.ts"'
      );
      expect(linting).toContain(
        'Linting mylib, myapp, myapp-e2e, mypublishablelib'
      );

      const unitTestsExcluded = runCommand(
        'npm run affected:test -- --files="libs/mylib/src/index.ts" --exclude=myapp,mypublishablelib'
      );
      expect(unitTestsExcluded).toContain('Testing mylib');
    },
    1000000
  );

  it(
    'should print, build, and test all apps',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');
      newLib('mypublishablelib --publishable');

      const affectedApps = runCommand('npm run affected:apps -- --all');
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).toContain('myapp2');
      expect(affectedApps).not.toContain('myapp-e2e');

      const build = runCommand('npm run affected:build -- --all');
      expect(build).toContain('Building myapp');
      expect(build).toContain('Building myapp2');
      expect(build).toContain('Building mypublishablelib');
      expect(build).not.toContain('is not registered with the build command');

      const buildExcluded = runCommand(
        'npm run affected:build -- --files="libs/mylib/src/index.ts" --exclude myapp,myapp2,mypublishablelib'
      );
      expect(buildExcluded).toContain('No projects to build');

      const e2e = runCommand('npm run affected:e2e -- --all');
      expect(e2e).toContain('Testing myapp-e2e, myapp2-e2e');

      const unitTests = runCommand('npm run affected:test -- --all');
      expect(unitTests).toContain(
        'Testing mypublishablelib, myapp2, myapp, mylib'
      );
    },
    1000000
  );
});
