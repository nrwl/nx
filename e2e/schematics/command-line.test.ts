import { newApp, newLib, newProject, readFile, runCLI, runCommand, updateFile } from '../utils';

describe('Command line', () => {
  it(
    'lint should ensure module boundaries',
    () => {
      newProject();
      newApp('myapp');
      newLib('mylib');
      newLib('lazylib');

      const tslint = JSON.parse(readFile('tslint.json'));
      tslint.rules['nx-enforce-module-boundaries'][1].lazyLoad.push('lazylib');
      updateFile('tslint.json', JSON.stringify(tslint, null, 2));

      updateFile(
        'apps/myapp/src/main.ts',
        `
      import '../../../libs/mylib';
      import '@nrwl/lazylib';
      import '@nrwl/mylib/deep';
    `
      );

      const out = runCLI('lint --type-check', { silenceError: true });
      expect(out).toContain('library imports must start with @nrwl/');
      expect(out).toContain('import of lazy-loaded libraries are forbidden');
      expect(out).toContain('deep imports into libraries are forbidden');
    },
    1000000
  );

  it(
    'nx-migrate should run migrations',
    () => {
      newProject();
      updateFile(
        'node_modules/@nrwl/schematics/migrations/20200101-test-migration.js',
        `
        exports.default = {
          description: 'Test migration',
          run: function() {
            console.log('Running test migration');
          }
        };
      `
      );
      const out = runCommand('npm run nx-migrate');
      expect(out).toContain('Test migration');
      expect(out).toContain('Running test migration');
      expect(out).toContain('All migrations run successfully');

      expect(runCommand('npm run nx-migrate')).toContain('No migrations to run');
    },
    1000000
  );

  it(
    'affected should print, build, and test affected apps',
    () => {
      newProject();
      newApp('myapp');
      newApp('myapp2');
      newLib('mylib');

      updateFile('apps/myapp/src/app/app.component.spec.ts', `import '@nrwl/mylib';`);

      updateRunAffectedToWorkInE2ESetup();

      const affectedApps = runCommand('npm run affected:apps -- --files="libs/mylib/index.ts"');
      expect(affectedApps).toContain('myapp');
      expect(affectedApps).not.toContain('myapp2');

      const build = runCommand('npm run affected:build -- --files="libs/mylib/index.ts"');
      expect(build).toContain('Building myapp');

      const e2e = runCommand('npm run affected:e2e -- --files="libs/mylib/index.ts"');
      expect(e2e).toContain('should display welcome message');
    },
    1000000
  );

  it(
    'format should check and reformat the code',
    () => {
      newProject();
      newApp('myapp');
      updateFile(
        'apps/myapp/src/main.ts',
        `
         const x = 3232;
    `
      );

      try {
        runCommand('npm run -s format:check');
        fail('boom');
      } catch (e) {
        expect(e.stdout.toString()).toContain('apps/myapp/src/main.ts');
      }
      runCommand('npm run format:write');
      expect(runCommand('npm run -s format:check')).toEqual('');
    },
    1000000
  );
});

function updateRunAffectedToWorkInE2ESetup() {
  const runAffected = readFile('node_modules/@nrwl/schematics/src/command-line/affected.js');
  const newRunAffected = runAffected
    .replace('ng build', '../../node_modules/.bin/ng build')
    .replace('ng e2e', '../../node_modules/.bin/ng e2e');
  updateFile('node_modules/@nrwl/schematics/src/command-line/affected.js', newRunAffected);
}
