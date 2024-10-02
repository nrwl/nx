import { addProjectConfiguration, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { scamGenerator } from './scam';

describe('SCAM Generator', () => {
  it('should create the inline scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: true,
      skipFormat: true,
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

  it('should create the separate scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: false,
      skipFormat: true,
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

  it('should create the scam correctly and export it for a secondary entrypoint', async () => {
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
    await scamGenerator(tree, {
      name: 'example',
      path: 'libs/lib1/feature/src/lib/example/example',
      inlineScam: false,
      export: true,
      skipFormat: true,
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
      export class ExampleComponentModule {}
      "
    `);
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example.component';
      export * from './lib/example/example.module';"
    `);
  });

  describe('--path', () => {
    it('should not throw when the directory does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'apps/app1/src/app/random/example/example.component.ts',
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

    it('should not matter if the directory starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT
      await scamGenerator(tree, {
        name: 'example',
        path: '/apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'apps/app1/src/app/random/example/example.component.ts',
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

    it('should throw when the directory does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      // ACT & ASSERT
      expect(
        scamGenerator(tree, {
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
