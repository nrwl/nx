import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';
import { names } from './name-utils';
import { updateWorkspace } from './workspace';

const testRunner = new SchematicTestRunner(
  '@nrwl/workspace',
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
  '@nrwl/express',
  join(__dirname, '../../../express/collection.json')
);

testRunner.registerCollection(
  '@nrwl/react',
  join(__dirname, '../../../react/collection.json')
);

testRunner.registerCollection(
  '@nrwl/angular',
  join(__dirname, '../../../angular/collection.json')
);

testRunner.registerCollection(
  '@nrwl/next',
  join(__dirname, '../../../next/collection.json')
);

testRunner.registerCollection(
  '@nrwl/nest',
  join(__dirname, '../../../nest/collection.json')
);

testRunner.registerCollection(
  '@nrwl/web',
  join(__dirname, '../../../web/collection.json')
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

export function createLibWithTests(
  tree: Tree,
  libName: string,
  testBuilder: string,
  testSetupFile: string
): Promise<Tree> {
  const { fileName } = names(libName);

  tree.create(`/libs/${fileName}/src/index.ts`, `\n`);

  return callRule(
    updateWorkspace((workspace) => {
      workspace.projects.add({
        name: fileName,
        root: `libs/${fileName}`,
        projectType: 'library',
        sourceRoot: `libs/${fileName}/src`,
        architect: {
          test: {
            builder: testBuilder,
            options: {
              setupFile: `libs/${fileName}/src/${testSetupFile}`,
            },
          },
        },
      });
    }),
    tree
  );
}
