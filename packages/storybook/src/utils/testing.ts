import { join } from 'path';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import {
  Tree,
  Rule,
  externalSchematic,
  apply,
  source
} from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

const testRunner = new SchematicTestRunner(
  '@nrwl/storybook',
  join(__dirname, '../../collection.json')
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

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = Tree.empty();
  appTree = createEmptyWorkspace(appTree);
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'library', {
      name: libName
    }),
    appTree
  );
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'component', {
      name: 'test-button',
      project: libName
    }),
    appTree
  );
  appTree.overwrite(
    `libs/${libName}/src/lib/test-button/test-button.component.ts`,
    `
import { Component, OnInit, Input } from '@angular/core';

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
  appTree = await callRule(
    externalSchematic('@nrwl/angular', 'component', {
      name: 'test-other',
      project: libName
    }),
    appTree
  );
  return appTree;
}
