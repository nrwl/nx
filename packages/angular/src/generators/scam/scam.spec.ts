import { addProjectConfiguration, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { scamGenerator } from './scam';

describe('SCAM Generator', () => {
  it('should create the inline scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamGenerator(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
    });

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

  it('should create the separate scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamGenerator(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: false,
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
      export class ExampleComponentModule {}"
    `);
  });

  it('should create the scam correctly and export it for a secondary entrypoint', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write('libs/lib1/feature/src/index.ts', '');
    writeJson(tree, 'libs/lib1/feature/ng-package.json', {
      lib: { entryFile: './src/index.ts' },
    });

    // ACT
    await scamGenerator(tree, {
      name: 'example',
      project: 'lib1',
      path: 'libs/lib1/feature/src/lib',
      inlineScam: false,
      export: true,
    });

    // ASSERT
    const componentModuleSource = tree.read(
      'libs/lib1/feature/src/lib/example/example.module.ts',
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
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from \\"./lib/example/example.component\\";
      export * from \\"./lib/example/example.module\\";"
    `);
  });

  describe('--path', () => {
    it('should not throw when the path does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamGenerator(tree, {
        name: 'example',
        project: 'app1',
        path: 'apps/app1/src/app/random',
        inlineScam: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'apps/app1/src/app/random/example/example.component.ts',
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

    it('should not matter if the path starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamGenerator(tree, {
        name: 'example',
        project: 'app1',
        path: '/apps/app1/src/app/random',
        inlineScam: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'apps/app1/src/app/random/example/example.component.ts',
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

    it('should throw when the path does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      try {
        await scamGenerator(tree, {
          name: 'example',
          project: 'app1',
          path: 'libs/proj/src/lib/random',
          inlineScam: true,
        });
      } catch (error) {
        // ASSERT
        expect(error).toMatchInlineSnapshot(
          `[Error: The path provided for the SCAM (libs/proj/src/lib/random) does not exist under the project root (apps/app1).]`
        );
      }
    });
  });
});
