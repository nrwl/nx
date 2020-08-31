import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Tree, Rule } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/jest',
  join(__dirname, '../../collection.json')
);

export function runSchematic<T = any>(
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
