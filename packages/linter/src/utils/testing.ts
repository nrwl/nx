import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { Tree } from '@angular-devkit/schematics';

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/linter-migrations',
  join(__dirname, '../../migrations.json')
);

export function runMigration<T = any>(
  migrationName: string,
  options: T,
  tree: Tree
) {
  return migrationTestRunner
    .runSchematicAsync<T>(migrationName, options, tree)
    .toPromise();
}
