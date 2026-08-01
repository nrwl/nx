import { readFileSync } from 'fs';
import { join } from 'path';
import * as migrateModule from './migrate';
import * as engine from './execute-migration';
import { runSingleMigration } from './migrate-ui-api';

describe('execute-migration re-export contract', () => {
  it('re-exports every execute-migration export from migrate with the same reference', () => {
    for (const key of Object.keys(engine)) {
      expect(migrateModule).toHaveProperty(key);
      expect((migrateModule as Record<string, unknown>)[key]).toBe(
        (engine as Record<string, unknown>)[key]
      );
    }
  });
});

describe('run-migration-process.js contract', () => {
  // run-migration-process.js does:
  //   const { runNxOrAngularMigration, ChangedDepInstaller } = require('./migrate');
  it('exposes runNxOrAngularMigration and ChangedDepInstaller as functions on migrate', () => {
    expect(typeof migrateModule.runNxOrAngularMigration).toBe('function');
    expect(typeof migrateModule.ChangedDepInstaller).toBe('function');
  });
});

describe('migrate-ui-api contract', () => {
  it('keeps the (workspacePath, migration, configuration) signature', () => {
    expect(typeof runSingleMigration).toBe('function');
    expect(runSingleMigration.length).toBe(3);
  });
});

describe('package.json exports map contract', () => {
  it('keeps the run-migration-process export entries', () => {
    const packageJsonPath = join(__dirname, '../../../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    // Keys contain dots, so index directly rather than using toHaveProperty's
    // dot-path notation.
    expect(
      packageJson.exports['./src/command-line/migrate/run-migration-process']
    ).toBeDefined();
    expect(
      packageJson.exports['./src/command-line/migrate/run-migration-process.js']
    ).toBeDefined();
  });
});
