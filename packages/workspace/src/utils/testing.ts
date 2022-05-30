import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Rule, Tree } from '@angular-devkit/schematics';
import { updateWorkspace } from './workspace';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { Architect } from '@angular-devkit/architect';
import { MockBuilderContext } from './testing-utils';
import { names } from '@nrwl/devkit';

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

const migrationTestRunner = new SchematicTestRunner(
  '@nrwl/workspace/migrations',
  join(__dirname, '../../migrations.json')
);

export function runExternalSchematic<T extends object = any>(
  collectionName: string,
  schematicName: string,
  options: T,
  tree: Tree
) {
  return testRunner
    .runExternalSchematicAsync(collectionName, schematicName, options, tree)
    .toPromise();
}

export function runSchematic<T extends object = any>(
  schematicName: string,
  options: T,
  tree: Tree
) {
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

export async function getTestArchitect() {
  const architectHost = new TestingArchitectHost('/root', '/root');
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);

  const architect = new Architect(architectHost, registry);

  await architectHost.addBuilderFromPackage(join(__dirname, '../..'));

  return [architect, architectHost] as [Architect, TestingArchitectHost];
}

export async function getMockContext() {
  const [architect, architectHost] = await getTestArchitect();

  const context = new MockBuilderContext(architect, architectHost);
  await context.addBuilderFromPackage(join(__dirname, '../..'));
  return context;
}
