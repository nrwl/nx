import { addProjectConfiguration } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createScamDirective } from './create-module';

describe('Create module in the tree', () => {
  it('should create the scam directive inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
      flat: false,
    });

    // ASSERT
    const directiveSource = tree.read(
      'apps/app1/src/app/example/example.directive.ts',
      'utf-8'
    );

    expect(directiveSource).toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]'
      })
      export class ExampleDirective {

        constructor() { }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });

  it('should create the scam directive separately correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: false,
      flat: false,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'apps/app1/src/app/example/example.module.ts',
      'utf-8'
    );
    expect(directiveModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExampleDirective } from './example.directive';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });

  it('should create the scam directive inline correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
      flat: true,
    });

    // ASSERT
    const directiveSource = tree.read(
      'apps/app1/src/app/example.directive.ts',
      'utf-8'
    );
    expect(directiveSource).toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]'
      })
      export class ExampleDirective {

        constructor() { }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });

  it('should create the scam directive separately correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: false,
      flat: true,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'apps/app1/src/app/example.module.ts',
      'utf-8'
    );
    expect(directiveModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExampleDirective } from './example.directive';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });

  it('should place the directive and scam in the correct folder when --path is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      flat: false,
      path: 'apps/app1/src/app/random',
      inlineScam: true,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'apps/app1/src/app/random/example/example.directive.ts',
      'utf-8'
    );
    expect(directiveModuleSource).toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]'
      })
      export class ExampleDirective {

        constructor() { }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });

  it('should place the directive and scam in the correct folder when --path and --flat is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularDirectiveSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'directive'
    );
    await angularDirectiveSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    createScamDirective(tree, {
      name: 'example',
      project: 'app1',
      flat: true,
      path: 'apps/app1/src/app/random',
      inlineScam: true,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'apps/app1/src/app/random/example.directive.ts',
      'utf-8'
    );
    expect(directiveModuleSource).toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]'
      })
      export class ExampleDirective {

        constructor() { }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}"
    `);
  });
});
