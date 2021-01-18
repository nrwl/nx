import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';

const testRunner = new SchematicTestRunner(
  '@nrwl/gatsby',
  join(__dirname, '../../collection.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/collection.json')
);

testRunner.registerCollection(
  '@nrwl/cypress',
  join(__dirname, '../../../cypress/collection.json')
);

testRunner.registerCollection(
  '@nrwl/react',
  join(__dirname, '../../../react/collection.json')
);

export function runSchematic(schematicName: string, options: any, tree: Tree) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}
