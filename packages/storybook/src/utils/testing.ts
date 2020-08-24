import { join, sep } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

import { schema } from '@angular-devkit/core';
import { externalSchematic, Rule, Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { Architect } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';

import {
  createEmptyWorkspace,
  MockBuilderContext,
} from '@nrwl/workspace/testing';

const testRunner = new SchematicTestRunner(
  '@nrwl/storybook',
  join(__dirname, '../../collection.json')
);

testRunner.registerCollection(
  '@nrwl/angular',
  join(__dirname, '../../../angular/collection.json')
);

testRunner.registerCollection(
  '@nrwl/react',
  join(__dirname, '../../../react/collection.json')
);

testRunner.registerCollection(
  '@nrwl/jest',
  join(__dirname, '../../../jest/collection.json')
);

testRunner.registerCollection(
  '@nrwl/cypress',
  join(__dirname, '../../../cypress/collection.json')
);

const migrationRunner = new SchematicTestRunner(
  '@nrwl/storybook/migrations',
  join(__dirname, '../../migrations.json')
);

export function runSchematic<SchemaOptions = any>(
  schematicName: string,
  options: SchemaOptions,
  tree: Tree
) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function runMigration(migrationName: string, options: any, tree: Tree) {
  return migrationRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}

export async function createTestUILib(
  libName: string,
  collectionName: '@nrwl/angular' | '@nrwl/react'
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic(collectionName, 'library', {
      name: libName,
    }),
    appTree
  );
  appTree = await callRule(
    externalSchematic(collectionName, 'component', {
      name: 'test-button',
      project: libName,
    }),
    appTree
  );

  if (collectionName === '@nrwl/angular') {
    updateAngularComponent(appTree);
  }
  if (collectionName === '@nrwl/react') {
    // @TODO
  }

  appTree = await callRule(
    externalSchematic(collectionName, 'component', {
      name: 'test-other',
      project: libName,
    }),
    appTree
  );

  return appTree;

  function updateAngularComponent(appTree: Tree) {
    appTree.overwrite(
      `libs/${libName}/src/lib/test-button/test-button.component.ts`,
      `
import { Component, OnInit, Input } from '@angular/core';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-test-button',
  templateUrl: './test-button.component.html',
  styleUrls: ['./test-button.component.css']
})
export class TestButtonComponent implements OnInit {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age: number;
  @Input() isOn = false;

  constructor() { }

  ngOnInit() {
  }

}
`
    );
    appTree.overwrite(
      `libs/${libName}/src/lib/test-button/test-button.component.html`,
      `<button [attr.type]="type" [ngClass]="style"></button>`
    );
  }
}

function getTempDir() {
  const tmpDir = tmpdir();
  const tmpFolder = `${tmpDir}${sep}`;
  return mkdtempSync(tmpFolder);
}

export async function getTestArchitect() {
  const tmpDir = getTempDir();
  const architectHost = new TestingArchitectHost(tmpDir, tmpDir);
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
