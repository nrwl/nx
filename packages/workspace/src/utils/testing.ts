import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import type { Rule, Tree } from '@angular-devkit/schematics';

const testRunner = new SchematicTestRunner(
  '@nrwl/workspace',
  join(__dirname, '../../generators.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/generators.json')
);

testRunner.registerCollection(
  '@nrwl/cypress',
  join(__dirname, '../../../cypress/generators.json')
);

testRunner.registerCollection(
  '@nrwl/express',
  join(__dirname, '../../../express/generators.json')
);

testRunner.registerCollection(
  '@nrwl/react',
  join(__dirname, '../../../react/generators.json')
);

testRunner.registerCollection(
  '@nrwl/angular',
  join(__dirname, '../../../angular/generators.json')
);

testRunner.registerCollection(
  '@nrwl/next',
  join(__dirname, '../../../next/generators.json')
);

testRunner.registerCollection(
  '@nrwl/node',
  join(__dirname, '../../../node/generators.json')
);

testRunner.registerCollection(
  '@nrwl/nest',
  join(__dirname, '../../../nest/generators.json')
);

testRunner.registerCollection(
  '@nrwl/web',
  join(__dirname, '../../../web/generators.json')
);

/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nrwl/devkit. Generators can be tested by simply calling them in it().
 */
export function runSchematic<T extends object = any>(
  schematicName: string,
  options: T,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

/**
 * @deprecated This will be removed in v17. Prefer writing Nx Generators with @nrwl/devkit. Generators can be tested by simply calling them in it().
 */
export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}
