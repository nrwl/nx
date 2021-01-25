/**
 * Testing file for internal schematics
 */

import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { Tree } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/nx-plugin',
  join(__dirname, '../../collection.json')
);

testRunner.registerCollection(
  '@nrwl/node',
  join(__dirname, '../../../node/collection.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/collection.json')
);

export function runSchematic<T>(schematicName: string, options: T, tree: Tree) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}
