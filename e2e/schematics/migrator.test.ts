import { newProject, runCommand, updateFile } from '../utils';
import { updateJsonFile } from '../../packages/schematics/src/collection/utility/fileutils';

describe('Migrator', () => {
  it(
    'should run migrations',
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
});
