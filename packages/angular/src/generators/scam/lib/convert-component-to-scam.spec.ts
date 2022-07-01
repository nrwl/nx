import { addProjectConfiguration } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { convertComponentToScam } from './convert-component-to-scam';

describe('convertComponentToScam', () => {
  it('should create the scam inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app/example',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: true,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentSource = tree.read(
      'apps/app1/src/app/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.component.html',
        styleUrls: ['./example.component.css']
      })
      export class ExampleComponent implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}"
    `);
  });

  it('should create the scam separately correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app/example',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: false,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

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
      export class ExampleComponentModule {}"
    `);
  });

  it('should create the scam inline correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: true,
        flat: true,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentSource = tree.read(
      'apps/app1/src/app/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.component.html',
        styleUrls: ['./example.component.css']
      })
      export class ExampleComponent implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}"
    `);
  });

  it('should create the scam separately correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: false,
        flat: true,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentModuleSource = tree.read(
      'apps/app1/src/app/example.module.ts',
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
      export class ExampleComponentModule {}"
    `);
  });

  it('should create the scam inline correctly when --type', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
      type: 'random',
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.random',
        filePath: 'apps/app1/src/app/example.random.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: true,
        flat: true,
        type: 'random',
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentSource = tree.read(
      'apps/app1/src/app/example.random.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.random.html',
        styleUrls: ['./example.random.css']
      })
      export class ExampleRandom implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleRandom],
        exports: [ExampleRandom],
      })
      export class ExampleRandomModule {}"
    `);
  });

  it('should create the scam separately correctly when --type', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
      type: 'random',
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.random',
        filePath: 'apps/app1/src/app/example.random.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        inlineScam: false,
        flat: true,
        type: 'random',
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

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
      export class ExampleRandomModule {}"
    `);
  });

  it('should place the component and scam in the correct folder when --path is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app/random/example',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/random/example/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        flat: false,
        inlineScam: true,
        path: 'apps/app1/src/app/random',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentModuleSource = tree.read(
      'apps/app1/src/app/random/example/example.component.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.component.html',
        styleUrls: ['./example.component.css']
      })
      export class ExampleComponent implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}"
    `);
  });

  it('should place the component and scam in the correct folder when --path and --flat is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'component'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    convertComponentToScam(
      tree,
      {
        directory: 'apps/app1/src/app/random',
        fileName: 'example.component',
        filePath: 'apps/app1/src/app/random/example.component.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        flat: true,
        inlineScam: true,
        path: 'apps/app1/src/app/random',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const componentModuleSource = tree.read(
      'apps/app1/src/app/random/example.component.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
      "import { Component, OnInit, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        templateUrl: './example.component.html',
        styleUrls: ['./example.component.css']
      })
      export class ExampleComponent implements OnInit {

        constructor() { }

        ngOnInit(): void {
        }

      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleComponent],
        exports: [ExampleComponent],
      })
      export class ExampleComponentModule {}"
    `);
  });
});
