import type { Tree } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import libraryGenerator from '../library/library';

export async function createStorybookTestWorkspaceForLib(
  libName: string
): Promise<Tree> {
  let tree = createTreeWithEmptyWorkspace();

  const moduleGenerator = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'module'
  );
  const componentGenerator = wrapAngularDevkitSchematic(
    '@schematics/angular',
    'component'
  );

  await libraryGenerator(tree, {
    name: libName,
    buildable: false,
    linter: Linter.EsLint,
    publishable: false,
    simpleModuleName: false,
    skipFormat: false,
    unitTestRunner: UnitTestRunner.Jest,
  });

  await componentGenerator(tree, {
    name: 'test-button',
    project: libName,
  });

  tree.write(
    `libs/${libName}/src/lib/test-button/test-button.component.ts`,
    `import { Component, Input } from '@angular/core';

export type ButtonStyle = 'default' | 'primary' | 'accent';

@Component({
  selector: 'proj-test-button',
  templateUrl: './test-button.component.html',
  styleUrls: ['./test-button.component.css']
})
export class TestButtonComponent {
  @Input('buttonType') type = 'button';
  @Input() style: ButtonStyle = 'default';
  @Input() age?: number;
  @Input() isOn = false;
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

  // create a module with components that get Angular exported and declared by variable
  await moduleGenerator(tree, {
    name: 'variable-spread-declare',
    project: libName,
  });

  await componentGenerator(tree, {
    name: 'variable-spread-declare-button',
    project: libName,
    path: `libs/${libName}/src/lib/variable-spread-declare`,
    module: 'variable-spread-declare',
  });

  await componentGenerator(tree, {
    name: 'variable-spread-declare-view',
    project: libName,
    path: `libs/${libName}/src/lib/variable-spread-declare`,
    module: 'variable-spread-declare',
  });

  await componentGenerator(tree, {
    name: 'variable-spread-declare-anotherview',
    project: libName,
    path: `libs/${libName}/src/lib/variable-spread-declare`,
    module: 'variable-spread-declare',
  });

  tree.write(
    `libs/${libName}/src/lib/variable-spread-declare/variable-spread-declare.module.ts`,
    `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VariableSpreadDeclareButtonComponent } from './variable-spread-declare-button/variable-spread-declare-button.component';
import { VariableSpreadDeclareViewComponent } from './variable-spread-declare-view/variable-spread-declare-view.component';
import { VariableSpreadDeclareAnotherviewComponent } from './variable-spread-declare-anotherview/variable-spread-declare-anotherview.component';

const COMPONENTS = [ 
  VariableSpreadDeclareButtonComponent, 
  VariableSpreadDeclareViewComponent 
]

@NgModule({
  imports: [CommonModule],
  declarations: [...COMPONENTS, VariableSpreadDeclareAnotherviewComponent],
})
export class VariableSpreadDeclareModule {}`
  );

  // create a module where declared components are pulled from a static member of the module
  await moduleGenerator(tree, {
    name: 'static-member-declarations',
    project: libName,
  });

  await componentGenerator(tree, {
    name: 'cmp1',
    project: libName,
    path: `libs/${libName}/src/lib/static-member-declarations`,
    module: 'static-member-declarations',
  });

  await componentGenerator(tree, {
    name: 'cmp2',
    project: libName,
    path: `libs/${libName}/src/lib/static-member-declarations`,
    module: 'static-member-declarations',
  });

  tree.write(
    `libs/${libName}/src/lib/static-member-declarations/static-member-declarations.module.ts`,
    `import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cmp1Component } from './cmp1/cmp1.component';
import { Cmp2Component } from './cmp2/cmp2.component';

@NgModule({
  imports: [CommonModule],
  declarations: StaticMemberDeclarationsModule.COMPONENTS,
  exports: StaticMemberDeclarationsModule.COMPONENTS
})
export class StaticMemberDeclarationsModule {
  static readonly COMPONENTS = [Cmp1Component, Cmp2Component];
}`
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
