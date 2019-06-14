import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/workspace',
  join(__dirname, '../../collection.json')
);

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/workspace/migrations',
  join(__dirname, '../../migrations.json')
);

export function runSchematic(schematicName: string, options: any, tree: Tree) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function runMigration(migrationName: string, options: any, tree: Tree) {
  return migrationTestRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}
