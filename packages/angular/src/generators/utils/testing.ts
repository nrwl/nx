import type { Tree } from '@nx/devkit';
import { names, readProjectConfiguration, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { UnitTestRunner } from '../../utils/test-runners';
import { angularDevkitVersion } from '../../utils/versions';
import { applicationGenerator } from '../application/application';
import type { Schema as ApplicationOptions } from '../application/schema';
import { componentGenerator } from '../component/component';
import { host } from '../host/host';
import type { Schema as HostOptions } from '../host/schema';
import { libraryGenerator } from '../library/library';
import type { Schema as LibraryOptions } from '../library/schema';
import { remote } from '../remote/remote';
import type { Schema as RemoteOptions } from '../remote/schema';

export async function generateTestApplication(
  tree: Tree,
  options: ApplicationOptions
): Promise<void> {
  addAngularPluginPeerDeps(tree);
  tree.write('.gitignore', '');
  await applicationGenerator(tree, options);
}

export async function generateTestHostApplication(
  tree: Tree,
  options: HostOptions
): Promise<void> {
  addAngularPluginPeerDeps(tree);
  tree.write('.gitignore', '');
  await host(tree, options);
}

export async function generateTestRemoteApplication(
  tree: Tree,
  options: RemoteOptions
): Promise<void> {
  addAngularPluginPeerDeps(tree);
  tree.write('.gitignore', '');
  await remote(tree, options);
}

export async function generateTestLibrary(
  tree: Tree,
  options: LibraryOptions
): Promise<void> {
  addAngularPluginPeerDeps(tree);
  tree.write('.gitignore', '');
  await libraryGenerator(tree, options);
}

export async function createStorybookTestWorkspaceForLib(
  libName: string
): Promise<Tree> {
  let tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  addAngularPluginPeerDeps(tree);
  tree.write('.gitignore', '');

  await libraryGenerator(tree, {
    name: libName,
    buildable: false,
    linter: Linter.EsLint,
    publishable: false,
    simpleName: false,
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
  generateModule(tree, {
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
  generateModule(tree, {
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
  generateModule(tree, {
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
  generateModule(tree, {
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
  generateModule(tree, {
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

function addAngularPluginPeerDeps(tree: Tree): void {
  updateJson(tree, 'package.json', (json) => ({
    ...json,
    devDependencies: {
      ...json.devDependencies,
      '@angular-devkit/core': angularDevkitVersion,
      '@angular-devkit/schematics': angularDevkitVersion,
      '@schematics/angular': angularDevkitVersion,
    },
  }));
}

function generateModule(
  tree: Tree,
  options: { name: string; project: string; path?: string }
): void {
  const project = readProjectConfiguration(tree, options.project);

  if (options.path === undefined) {
    const sourceRoot = project.sourceRoot ?? `${project.root}/src`;
    const projectDirName =
      project.projectType === 'application' ? 'app' : 'lib';
    options.path = `${sourceRoot}/${projectDirName}`;
  }

  const moduleNames = names(options.name);
  const moduleFilePath = `${options.path}/${moduleNames.fileName}/${moduleNames.fileName}.module.ts`;

  tree.write(
    moduleFilePath,
    `import { NgModule } from '@angular/core';
  import { CommonModule } from '@angular/common';
  
  @NgModule({
    declarations: [],
    imports: [CommonModule],
  })
  export class ${moduleNames.className}Module {}`
  );
}
