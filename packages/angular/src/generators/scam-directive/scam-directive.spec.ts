import {
  addProjectConfiguration,
  readNxJson,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { scamDirectiveGenerator } from './scam-directive';

describe('SCAM Directive Generator', () => {
  it('should create the inline scam directive correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
    const directiveSource = tree.read('apps/app1/src/app/example.ts', 'utf-8');
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

  it('should create the inline scam directive with the provided "directive" type', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await scamDirectiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      inlineScam: true,
      type: 'directive',
      skipFormat: true,
    });

    expect(tree.read('apps/app1/src/app/example.directive.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Directive, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Directive({
        selector: '[example]',
        standalone: false
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
    const tree = createTreeWithEmptyWorkspace();
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
      'apps/app1/src/app/example-module.ts',
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

  it('should create the module respecting the "typeSeparator" generator default', async () => {
    const tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.generators = {
      ...nxJson.generators,
      '@nx/angular:module': { typeSeparator: '.' },
    };
    updateNxJson(tree, nxJson);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await scamDirectiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example',
      inlineScam: false,
      skipFormat: true,
    });

    expect(tree.read('apps/app1/src/app/example.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
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

  it('should handle path with file extension', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await scamDirectiveGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example.directive.ts',
      inlineScam: true,
      skipFormat: true,
    });

    const directiveSource = tree.read(
      'apps/app1/src/app/example.directive.ts',
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

  it('should create the scam directive correctly and export it for a secondary entrypoint', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
      'libs/lib1/feature/src/lib/example/example-module.ts',
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
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example';
      export * from './lib/example/example-module';"
    `);
  });

  it('should error when the class name is invalid', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await expect(
      scamDirectiveGenerator(tree, {
        name: '404',
        path: 'apps/app1/src/app/example',
      })
    ).rejects.toThrow('Class name "404" is invalid.');
  });

  describe('--path', () => {
    it('should not throw when the path exists under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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
        'apps/app1/src/app/random/example/example.ts',
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

    it('should not matter if the path starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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
        'apps/app1/src/app/random/example/example.ts',
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

    it('should throw when the path does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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

  describe('compat', () => {
    it('should generate the scam directive with the "directive" type for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies = {
          ...json.dependencies,
          '@angular/core': '~19.2.0',
        };
        return json;
      });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      await scamDirectiveGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example',
        inlineScam: true,
        skipFormat: true,
      });

      expect(tree.read('apps/app1/src/app/example.directive.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Directive, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Directive({
          selector: '[example]',
          standalone: false
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

    it('should generate the module with the "." type separator for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies = {
          ...json.dependencies,
          '@angular/core': '~19.2.0',
        };
        return json;
      });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      await scamDirectiveGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example',
        inlineScam: false,
        skipFormat: true,
      });

      expect(tree.read('apps/app1/src/app/example.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
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
  });
});
