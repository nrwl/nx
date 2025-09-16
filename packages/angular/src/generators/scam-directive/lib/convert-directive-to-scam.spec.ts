import { addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { directiveGenerator } from '../../directive/directive';
import { convertDirectiveToScam } from './convert-directive-to-scam';

describe('convertDirectiveToScam', () => {
  it('should create the scam directive inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await directiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      skipImport: true,
      export: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertDirectiveToScam(tree, {
      path: 'apps/app1/src/app/example/example',
      directory: 'apps/app1/src/app/example',
      fileName: 'example',
      filePath: 'apps/app1/src/app/example/example.ts',
      name: 'example',
      projectName: 'app1',
      modulePath: 'apps/app1/src/app/example/example-module.ts',
      export: false,
      inlineScam: true,
      symbolName: 'Example',
    });

    // ASSERT
    const directiveSource = tree.read(
      'apps/app1/src/app/example/example.ts',
      'utf-8'
    );
    expect(directiveSource).toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]',
        standalone: false
      })
      export class Example {
        constructor() {}
      }

      @NgModule({
        imports: [CommonModule],
        declarations: [Example],
        exports: [Example],
      })
      export class ExampleModule {}
      "
    `);
  });

  it('should create the scam directive separately correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await directiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      skipImport: true,
      export: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertDirectiveToScam(tree, {
      path: 'apps/app1/src/app/example/example',
      directory: 'apps/app1/src/app/example',
      fileName: 'example',
      filePath: 'apps/app1/src/app/example/example.ts',
      name: 'example',
      projectName: 'app1',
      modulePath: 'apps/app1/src/app/example/example-module.ts',
      export: false,
      inlineScam: false,
      symbolName: 'Example',
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'apps/app1/src/app/example/example-module.ts',
      'utf-8'
    );
    expect(directiveModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { Example } from './example';

      @NgModule({
        imports: [CommonModule],
        declarations: [Example],
        exports: [Example],
      })
      export class ExampleModule {}
      "
    `);
  });
});
