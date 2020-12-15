import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { Tree } from '@angular-devkit/schematics';

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/linter-migrations',
  join(__dirname, '../../migrations.json')
);

const testRunner = new SchematicTestRunner(
  '@nrwl/linter',
  join(__dirname, '../../collection.json')
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

export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}
