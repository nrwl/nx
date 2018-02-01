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
      import '@nrwl/myapp';
      import '@nrwl/myapp/main';
    `
      );

      const out = runCLI('lint --type-check', { silenceError: true });
      expect(out).toContain('library imports must start with @nrwl/');
      expect(out).toContain('imports of lazy-loaded libraries are forbidden');
      expect(out).toContain('deep imports into libraries are forbidden');
      expect(out).toContain('imports of apps are forbidden');
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
      const checkOut = runCommand('npm run nx-migrate:check');
      expect(checkOut).toContain('Run "npm run nx-migrate" to run the following migrations');
      expect(checkOut).toContain('20200101-test-migration');

      const migrateOut = runCommand('npm run nx-migrate');
      expect(migrateOut).toContain('Test migration');
      expect(migrateOut).toContain('Running test migration');
      expect(migrateOut).toContain(
        `The latestMigration property in .angular-cli.json has been set to "20200101-test-migration".`
      );

      updateFile(
        'node_modules/@nrwl/schematics/migrations/20200102-test-migration.js',
        `
        exports.default = {
          description: 'Test migration2',
          run: function() {
            console.log('Running test migration');
          }
        };
      `
      );

      const checkOut2 = runCommand('npm run nx-migrate:check');
      expect(checkOut2).toContain('Run "npm run nx-migrate" to run the following migrations');
      expect(checkOut2).toContain('20200102-test-migration');

      const skipOut = runCommand('npm run nx-migrate:skip');
      expect(skipOut).toContain(
        `The latestMigration property in .angular-cli.json has been set to "20200102-test-migration".`
      );

      expect(runCommand('npm run nx-migrate:check')).not.toContain('IMPORTANT');
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
         const x = 1111;
    `
      );

      updateFile(
        'apps/myapp/src/app/app.module.ts',
        `
         const y = 1111;
    `
      );

      updateFile(
        'apps/myapp/src/app/app.component.ts',
        `
         const z = 1111;
    `
      );

      try {
        // this will group it by app, so all three files will be "marked"
        runCommand('npm run -s format:check -- --files="apps/myapp/src/app/app.module.ts" --libs-and-apps');
        fail('boom');
      } catch (e) {
        expect(e.stdout.toString()).toContain('apps/myapp/src/main.ts');
        expect(e.stdout.toString()).toContain('apps/myapp/src/app/app.module.ts');
        expect(e.stdout.toString()).toContain('apps/myapp/src/app/app.component.ts');
      }

      try {
        // this is a global run
        runCommand('npm run -s format:check');
        fail('boom');
      } catch (e) {
        expect(e.stdout.toString()).toContain('apps/myapp/src/main.ts');
        expect(e.stdout.toString()).toContain('apps/myapp/src/app/app.module.ts');
        expect(e.stdout.toString()).toContain('apps/myapp/src/app/app.component.ts');
      }
      runCommand(
        'npm run format:write -- --files="apps/myapp/src/app/app.module.ts,apps/myapp/src/app/app.component.ts"'
      );

      try {
        runCommand('npm run -s format:check');
        fail('boom');
      } catch (e) {
        expect(e.stdout.toString()).toContain('apps/myapp/src/main.ts');
        expect(e.stdout.toString()).not.toContain('apps/myapp/src/app/app.module.ts');
        expect(e.stdout.toString()).not.toContain('apps/myapp/src/app/app.component.ts');
      }

      runCommand('npm run format:write');
      expect(runCommand('npm run -s format:check')).toEqual('');
    },
    1000000
  );
});
