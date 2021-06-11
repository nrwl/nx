import type { Tree } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

export async function createStorybookTestWorkspaceForLib(
  libName: string
): Promise<Tree> {
  let tree = createTreeWithEmptyWorkspace();

  const libGenerator = wrapAngularDevkitSchematic('@nrwl/angular', 'library');
  const moduleGenerator = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'module'
  );
  const componentGenerator = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );

  await libGenerator(tree, { name: libName });

  await componentGenerator(tree, {
    name: 'test-button',
    project: libName,
  });

  tree.write(
    `libs/${libName}/src/lib/test-button/test-button.component.ts`,
    `import { Component, OnInit, Input } from '@angular/core';

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

}`
  );

  tree.write(
    `libs/${libName}/src/lib/test-button/test-button.component.html`,
    `<button [attr.type]="type" [ngClass]="style"></button>`
  );

  const modulePath = `libs/${libName}/src/lib/${libName}.module.ts`;
  tree.write(
    modulePath,
    `import * as ButtonExports from './test-button/test-button.component';
    ${tree.read(modulePath)}`
  );

  // create a module with component that gets exported in a barrel file
  await moduleGenerator(tree, {
    name: 'barrel',
    project: libName,
  });

  await componentGenerator(tree, {
    name: 'barrel-button',
    project: libName,
    path: `libs/${libName}/src/lib/barrel`,
    module: 'barrel',
  });

  tree.write(
    `libs/${libName}/src/lib/barrel/barrel-button/index.ts`,
    `export * from './barrel-button.component';`
  );

  tree.write(
    `libs/${libName}/src/lib/barrel/barrel.module.ts`,
    `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarrelButtonComponent } from './barrel-button';

@NgModule({
  imports: [CommonModule],
  declarations: [BarrelButtonComponent],
})
export class BarrelModule {}`
  );

  // create a module with components that get Angular exported and declared by variable
  await moduleGenerator(tree, {
    name: 'variable-declare',
    project: libName,
  });

  await componentGenerator(tree, {
    name: 'variable-declare-button',
    project: libName,
    path: `libs/${libName}/src/lib/variable-declare`,
    module: 'variable-declare',
  });

  await componentGenerator(tree, {
    name: 'variable-declare-view',
    project: libName,
    path: `libs/${libName}/src/lib/variable-declare`,
    module: 'variable-declare',
  });

  tree.write(
    `libs/${libName}/src/lib/variable-declare/variable-declare.module.ts`,
    `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VariableDeclareButtonComponent } from './variable-declare-button/variable-declare-button.component';
import { VariableDeclareViewComponent } from './variable-declare-view/variable-declare-view.component';

const COMPONENTS = [
  VariableDeclareButtonComponent,
  VariableDeclareViewComponent
]

@NgModule({
  imports: [CommonModule],
  declarations: COMPONENTS,
  exports: COMPONENTS
})
export class VariableDeclareModule {}`
  );

  // create another button in a nested subpath
  await moduleGenerator(tree, {
    name: 'nested',
    project: libName,
    path: `libs/${libName}/src/lib`,
  });

  await componentGenerator(tree, {
    name: 'nested-button',
    project: libName,
    module: 'nested',
    path: `libs/${libName}/src/lib/nested`,
  });

  await componentGenerator(tree, {
    name: 'test-other',
    project: libName,
  });

  return tree;
}
