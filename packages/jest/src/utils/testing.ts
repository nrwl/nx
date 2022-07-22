import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Tree, Rule } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/jest',
  join(__dirname, '../../generators.json')
);

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/jest/migrations',
  join(__dirname, '../../migrations.json')
);

export function runSchematic<T extends object = any>(
  schematicName: string,
  options: T,
  tree: Tree
) {
  return testRunner
    .runSchematicAsync<T>(schematicName, options, tree)
    .toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function runMigration<T extends object = any>(
  migrationName: string,
  options: T,
  tree: Tree
) {
  return migrationTestRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}
