import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';

const migrationRunner = new SchematicTestRunner(
  '@nrwl/linter/migrations',
  join(__dirname, '../../migrations.json')
);

export function runMigration(migrationName: string, options: any, tree: Tree) {
  return migrationRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}
