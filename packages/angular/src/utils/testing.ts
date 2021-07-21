import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/angular',
  join(__dirname, '../../generators.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/generators.json')
);

testRunner.registerCollection(
  '@nrwl/workspace',
  join(__dirname, '../../../workspace/generators.json')
);

testRunner.registerCollection(
  '@nrwl/cypress',
  join(__dirname, '../../../cypress/generators.json')
);

testRunner.registerCollection(
  '@nrwl/storybook',
  join(__dirname, '../../../storybook/generators.json')
);

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/workspace',
  join(__dirname, '../../migrations.json')
);

/**
 * @deprecated will be removed in v13.
 */
export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function runMigration<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return migrationTestRunner
    .runSchematicAsync(schematicName, options, tree)
    .toPromise();
}

/**
 * @deprecated will be removed in v13.
 */
export function runExternalSchematic<SchemaOptions = any>(
  collectionName: string,
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner
    .runExternalSchematicAsync(collectionName, schematicName, options, tree)
    .toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}
