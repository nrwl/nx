import { addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from '../../component/component';
import { convertComponentToScam } from './convert-component-to-scam';

describe('convertComponentToScam', () => {
  it('should create the scam inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await componentGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      skipImport: true,
      export: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertComponentToScam(tree, {
      path: 'apps/app1/src/app/example/example',
      directory: 'apps/app1/src/app/example',
      fileName: 'example.component',
      filePath: 'apps/app1/src/app/example/example.component.ts',
      name: 'example',
      projectName: 'app1',
      export: false,
      inlineScam: true,
      symbolName: 'ExampleComponent',
    });

    // ASSERT
    const componentSource = tree.read(
      'apps/app1/src/app/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.component.html',
        styleUrl: './example.component.css'
      })
      export class ExampleComponent {}

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}
      "
    `);
  });

  it('should create the scam separately correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await componentGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      skipImport: true,
      export: false,
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertComponentToScam(tree, {
      path: 'apps/app1/src/app/example/example',
      directory: 'apps/app1/src/app/example',
      fileName: 'example.component',
      filePath: 'apps/app1/src/app/example/example.component.ts',
      name: 'example',
      projectName: 'app1',
      export: false,
      inlineScam: false,
      symbolName: 'ExampleComponent',
    });

    // ASSERT
    const componentModuleSource = tree.read(
      'apps/app1/src/app/example/example.module.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExampleComponent } from './example.component';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}
      "
    `);
  });

  it('should create the scam inline correctly when --type', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await componentGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      skipImport: true,
      export: false,
      type: 'random',
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertComponentToScam(tree, {
      path: 'apps/app1/src/app/example',
      directory: 'apps/app1/src/app',
      fileName: 'example.random',
      filePath: 'apps/app1/src/app/example.random.ts',
      name: 'example',
      projectName: 'app1',
      export: false,
      inlineScam: true,
      type: 'random',
      symbolName: 'ExampleRandom',
    });

    // ASSERT
    const componentSource = tree.read(
      'apps/app1/src/app/example.random.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.random.html',
        styleUrl: './example.random.css'
      })
      export class ExampleRandom {}

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleRandom],
        exports: [ExampleRandom],
      })
      export class ExampleRandomModule {}
      "
    `);
  });

  it('should create the scam separately correctly when --type', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await componentGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      skipImport: true,
      export: false,
      type: 'random',
      standalone: false,
      skipFormat: true,
    });

    // ACT
    convertComponentToScam(tree, {
      path: 'apps/app1/src/app/example',
      directory: 'apps/app1/src/app',
      fileName: 'example.random',
      filePath: 'apps/app1/src/app/example.random.ts',
      name: 'example',
      projectName: 'app1',
      export: false,
      inlineScam: false,
      type: 'random',
      symbolName: 'ExampleRandom',
    });

    // ASSERT
    const componentModuleSource = tree.read(
      'apps/app1/src/app/example.module.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExampleRandom } from './example.random';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleRandom],
        exports: [ExampleRandom],
      })
      export class ExampleRandomModule {}
      "
    `);
  });
});
