import { addProjectConfiguration, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { scamDirectiveGenerator } from './scam-directive';

describe('SCAM Directive Generator', () => {
  it('should create the inline scam directive correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamDirectiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      inlineScam: true,
      skipFormat: true,
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
        constructor() {}
      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExampleDirective],
        exports: [ExampleDirective],
      })
      export class ExampleDirectiveModule {}
      "
    `);
  });

  it('should create the separate scam directive correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamDirectiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      inlineScam: false,
      skipFormat: true,
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
      export class ExampleDirectiveModule {}
      "
    `);
  });

  it('should create the scam directive correctly and export it for a secondary entrypoint', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
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
      path: 'libs/lib1/feature/src/lib/example/example',
      inlineScam: false,
      export: true,
      skipFormat: true,
    });

    // ASSERT
    const directiveModuleSource = tree.read(
      'libs/lib1/feature/src/lib/example/example.module.ts',
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
      export class ExampleDirectiveModule {}
      "
    `);
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example.directive';
      export * from './lib/example/example.module';"
    `);
  });

  describe('--path', () => {
    it('should not throw when the path does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamDirectiveGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
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
          constructor() {}
        }

        @NgModule({
          imports: [CommonModule],
          declarations: [ExampleDirective],
          exports: [ExampleDirective],
        })
        export class ExampleDirectiveModule {}
        "
      `);
    });

    it('should not matter if the path starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamDirectiveGenerator(tree, {
        name: 'example',
        path: '/apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
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
          constructor() {}
        }

        @NgModule({
          imports: [CommonModule],
          declarations: [ExampleDirective],
          exports: [ExampleDirective],
        })
        export class ExampleDirectiveModule {}
        "
      `);
    });

    it('should throw when the path does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT & ASSERT
      expect(
        scamDirectiveGenerator(tree, {
          name: 'example',
          path: 'libs/proj/src/lib/random/example/example',
          inlineScam: true,
          skipFormat: true,
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"The provided directory resolved relative to the current working directory "libs/proj/src/lib/random/example" does not exist under any project root. Please make sure to navigate to a location or provide a directory that exists under a project root."`
      );
    });
  });
});
