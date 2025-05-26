import {
  addProjectConfiguration,
  readNxJson,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { scamGenerator } from './scam';

describe('SCAM Generator', () => {
  it('should create the inline scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
      'apps/app1/src/app/example/example.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        standalone: false,
        templateUrl: './example.html',
        styleUrl: './example.css'
      })
      export class Example {}

      @NgModule({
        imports: [CommonModule],
        declarations: [Example],
        exports: [Example],
      })
      export class ExampleModule {}
      "
    `);
  });

  it('should create the separate scam correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
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
      'apps/app1/src/app/example/example-module.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
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

    await scamGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: false,
      skipFormat: true,
    });

    expect(tree.read('apps/app1/src/app/example/example.module.ts', 'utf-8'))
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

    await scamGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example.component.ts',
      inlineScam: true,
      skipFormat: true,
    });

    const componentSource = tree.read(
      'apps/app1/src/app/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchInlineSnapshot(`
      "import { Component, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Component({
        selector: 'example',
        standalone: false,
        templateUrl: './example.component.html',
        styleUrl: './example.component.css'
      })
      export class Example {}

      @NgModule({
        imports: [CommonModule],
        declarations: [Example],
        exports: [Example],
      })
      export class ExampleModule {}
      "
    `);
  });

  it('should create the scam correctly and export it for a secondary entrypoint', async () => {
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
    await scamGenerator(tree, {
      name: 'example',
      path: 'libs/lib1/feature/src/lib/example/example',
      inlineScam: false,
      export: true,
      skipFormat: true,
    });

    // ASSERT
    const componentModuleSource = tree.read(
      'libs/lib1/feature/src/lib/example/example-module.ts',
      'utf-8'
    );
    expect(componentModuleSource).toMatchInlineSnapshot(`
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
      scamGenerator(tree, {
        name: '404',
        path: 'apps/app1/src/app/example/example',
      })
    ).rejects.toThrow('Class name "404" is invalid.');
  });

  describe('--path', () => {
    it('should not throw when the directory exists under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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
        'apps/app1/src/app/random/example/example.ts',
        'utf-8'
      );
      expect(componentSource).toMatchInlineSnapshot(`
        "import { Component, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Component({
          selector: 'example',
          standalone: false,
          templateUrl: './example.html',
          styleUrl: './example.css'
        })
        export class Example {}

        @NgModule({
          imports: [CommonModule],
          declarations: [Example],
          exports: [Example],
        })
        export class ExampleModule {}
        "
      `);
    });

    it('should not matter if the directory starts with a slash', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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
        'apps/app1/src/app/random/example/example.ts',
        'utf-8'
      );
      expect(componentSource).toMatchInlineSnapshot(`
        "import { Component, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Component({
          selector: 'example',
          standalone: false,
          templateUrl: './example.html',
          styleUrl: './example.css'
        })
        export class Example {}

        @NgModule({
          imports: [CommonModule],
          declarations: [Example],
          exports: [Example],
        })
        export class ExampleModule {}
        "
      `);
    });

    it('should throw when the directory does not exist under project', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
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

  describe('compat', () => {
    it('should generate the component with the "component" type for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '~19.2.0';
        return json;
      });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      await scamGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      const componentSource = tree.read(
        'apps/app1/src/app/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchInlineSnapshot(`
        "import { Component, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Component({
          selector: 'example',
          standalone: false,
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

    it('should generate the module file with the "." type separator for versions lower than v20', async () => {
      const tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.dependencies['@angular/core'] = '~19.2.0';
        return json;
      });
      addProjectConfiguration(tree, 'app1', {
        projectType: 'application',
        sourceRoot: 'apps/app1/src',
        root: 'apps/app1',
      });

      await scamGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example/example',
        inlineScam: false,
        skipFormat: true,
      });

      expect(tree.read('apps/app1/src/app/example/example.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
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
  });
});
