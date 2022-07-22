import { join } from 'path';
import { externalSchematic, Rule, Tree } from '@angular-devkit/schematics';
import { Tree as NrwlTree } from '@nrwl/devkit';

import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import libraryGenerator from '@nrwl/workspace/src/generators/library/library';
import { Linter } from '@nrwl/linter';

const testRunner = new SchematicTestRunner(
  '@nrwl/storybook',
  join(__dirname, '../../generators.json')
);

['angular', 'react', 'jest', 'cypress'].forEach((collection) =>
  testRunner.registerCollection(
    `@nrwl/${collection}`,
    join(__dirname, `../../../${collection}/generators.json`)
  )
);

const migrationRunner = new SchematicTestRunner(
  '@nrwl/storybook/migrations',
  join(__dirname, '../../migrations.json')
);

export function runSchematic(schematicName: string, options: any, tree: Tree) {
  return testRunner.runSchematicAsync(schematicName, options, tree).toPromise();
}

export function runExternalSchematic(
  collectionName: string,
  schematicName: string,
  options: any,
  tree: Tree
) {
  return testRunner
    .runExternalSchematicAsync(collectionName, schematicName, options, tree)
    .toPromise();
}

export function callRule(rule: Rule, tree: Tree) {
  return testRunner.callRule(rule, tree).toPromise();
}

export function runMigration(migrationName: string, options: any, tree: Tree) {
  return migrationRunner
    .runSchematicAsync(migrationName, options, tree)
    .toPromise();
}

export async function createTestUILibNoNgDevkit(
  appTree: NrwlTree,
  libName: string
): Promise<NrwlTree> {
  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    name: libName,
    standaloneConfig: false,
  });

  return appTree;
}

export async function createTestUILib(
  libName: string,
  collectionName: '@nrwl/angular' | '@nrwl/react',
  options: any = {}
): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic(collectionName, 'library', {
      name: libName,
      ...options,
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

export function deleteNewConfigurationAndCreateNew(
  appTree: NrwlTree,
  projectStorybookRoot: string
): NrwlTree {
  // Remove new Storybook configuration
  appTree.delete(`.storybook/main.js`);
  appTree.delete(`.storybook/tsconfig.json`);
  appTree.delete(`${projectStorybookRoot}/main.js`);
  appTree.delete(`${projectStorybookRoot}/preview.js`);
  appTree.delete(`${projectStorybookRoot}/tsconfig.json`);

  // Create old Storybook configuration
  appTree.write(`.storybook/addons.js`, 'console.log("hello")');
  appTree.write(`.storybook/webpack.config.js`, 'console.log("hello")');
  appTree.write(`.storybook/tsconfig.json`, '{"test": "hello"}');
  appTree.write(`${projectStorybookRoot}/config.js`, 'console.log("hello")');
  appTree.write(`${projectStorybookRoot}/addons.js`, 'console.log("hello")');
  appTree.write(
    `${projectStorybookRoot}/webpack.config.js`,
    'console.log("hello")'
  );
  appTree.write(`${projectStorybookRoot}/tsconfig.json`, '{"test": "hello"}');

  return appTree;
}
