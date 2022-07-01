import { addProjectConfiguration, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import scamDirectiveGenerator from './scam-directive';

describe('SCAM Directive Generator', () => {
  it('should create the inline scam directive correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamDirectiveGenerator(tree, {
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

  it('should create the separate scam directive correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamDirectiveGenerator(tree, {
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

  it('should create the scam directive correctly and export it for a secondary entrypoint', async () => {
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
    await scamDirectiveGenerator(tree, {
      name: 'example',
      project: 'lib1',
      path: 'libs/lib1/feature/src/lib',
      inlineScam: false,
      export: true,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'libs/lib1/feature/src/lib/example.module.ts',
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
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from \\"./lib/example.directive\\";
      export * from \\"./lib/example.module\\";"
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
      await scamDirectiveGenerator(tree, {
        name: 'example',
        project: 'app1',
        path: 'apps/app1/src/app/random',
        inlineScam: true,
        flat: false,
      });

      // ASSERT
      const directiveSource = tree.read(
        'apps/app1/src/app/random/example/example.directive.ts',
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

    it('should not matter if the path starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamDirectiveGenerator(tree, {
        name: 'example',
        project: 'app1',
        path: '/apps/app1/src/app/random',
        inlineScam: true,
        flat: false,
      });

      // ASSERT
      const directiveSource = tree.read(
        'apps/app1/src/app/random/example/example.directive.ts',
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
        await scamDirectiveGenerator(tree, {
          name: 'example',
          project: 'app1',
          path: 'libs/proj/src/lib/random',
          inlineScam: true,
          flat: false,
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
