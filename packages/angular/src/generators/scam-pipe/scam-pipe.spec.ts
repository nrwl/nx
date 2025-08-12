import {
  addProjectConfiguration,
  readNxJson,
  updateJson,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { scamPipeGenerator } from './scam-pipe';

describe('SCAM Pipe Generator', () => {
  it('should create the inline scam pipe correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: true,
      skipFormat: true,
    });

    // ASSERT
    const pipeSource = tree.read(
      'apps/app1/src/app/example/example-pipe.ts',
      'utf-8'
    );
    expect(pipeSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example',
        standalone: false
      })
      export class ExamplePipe implements PipeTransform {
        transform(value: unknown, ...args: unknown[]): unknown {
          return null;
        }
      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
      "
    `);
  });

  it('should create the inline scam pipe file with the provided type separator', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: true,
      typeSeparator: '.',
      skipFormat: true,
    });

    const pipeSource = tree.read(
      'apps/app1/src/app/example/example.pipe.ts',
      'utf-8'
    );
    expect(pipeSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example',
        standalone: false
      })
      export class ExamplePipe implements PipeTransform {
        transform(value: unknown, ...args: unknown[]): unknown {
          return null;
        }
      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
      "
    `);
  });

  it('should create the separate scam pipe correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    // ACT
    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: false,
      skipFormat: true,
    });

    // ASSERT
    const pipeModuleSource = tree.read(
      'apps/app1/src/app/example/example-module.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExamplePipe } from './example-pipe';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
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

    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example',
      inlineScam: false,
      skipFormat: true,
    });

    expect(tree.read('apps/app1/src/app/example/example.module.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExamplePipe } from './example-pipe';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
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

    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'apps/app1/src/app/example/example.pipe.ts',
      inlineScam: true,
      skipFormat: true,
    });

    const pipeSource = tree.read(
      'apps/app1/src/app/example/example.pipe.ts',
      'utf-8'
    );
    expect(pipeSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example',
        standalone: false
      })
      export class ExamplePipe implements PipeTransform {
        transform(value: unknown, ...args: unknown[]): unknown {
          return null;
        }
      }

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
      "
    `);
  });

  it('should create the scam pipe correctly and export it for a secondary entrypoint', async () => {
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
    await scamPipeGenerator(tree, {
      name: 'example',
      path: 'libs/lib1/feature/src/lib/example/example',
      inlineScam: false,
      export: true,
      skipFormat: true,
    });

    // ASSERT
    const pipeModuleSource = tree.read(
      'libs/lib1/feature/src/lib/example/example-module.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExamplePipe } from './example-pipe';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}
      "
    `);
    const secondaryEntryPointSource = tree.read(
      `libs/lib1/feature/src/index.ts`,
      'utf-8'
    );
    expect(secondaryEntryPointSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example-pipe';
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
      scamPipeGenerator(tree, {
        name: '404',
        path: 'apps/app1/src/app/example/example',
      })
    ).rejects.toThrow('Class name "404Pipe" is invalid.');
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
      await scamPipeGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      // ASSERT
      const pipeSource = tree.read(
        'apps/app1/src/app/random/example/example-pipe.ts',
        'utf-8'
      );
      expect(pipeSource).toMatchInlineSnapshot(`
        "import { Pipe, PipeTransform, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Pipe({
          name: 'example',
          standalone: false
        })
        export class ExamplePipe implements PipeTransform {
          transform(value: unknown, ...args: unknown[]): unknown {
            return null;
          }
        }

        @NgModule({
          imports: [CommonModule],
          declarations: [ExamplePipe],
          exports: [ExamplePipe],
        })
        export class ExamplePipeModule {}
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
      await scamPipeGenerator(tree, {
        name: 'example',
        path: '/apps/app1/src/app/random/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      // ASSERT
      const pipeSource = tree.read(
        'apps/app1/src/app/random/example/example-pipe.ts',
        'utf-8'
      );
      expect(pipeSource).toMatchInlineSnapshot(`
        "import { Pipe, PipeTransform, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Pipe({
          name: 'example',
          standalone: false
        })
        export class ExamplePipe implements PipeTransform {
          transform(value: unknown, ...args: unknown[]): unknown {
            return null;
          }
        }

        @NgModule({
          imports: [CommonModule],
          declarations: [ExamplePipe],
          exports: [ExamplePipe],
        })
        export class ExamplePipeModule {}
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
        scamPipeGenerator(tree, {
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
    it('should generate scam pipe file with the "." type separator for versions lower than v20', async () => {
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

      await scamPipeGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example/example',
        inlineScam: true,
        skipFormat: true,
      });

      expect(tree.read('apps/app1/src/app/example/example.pipe.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { Pipe, PipeTransform, NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @Pipe({
          name: 'example',
          standalone: false
        })
        export class ExamplePipe implements PipeTransform {
          transform(value: unknown, ...args: unknown[]): unknown {
            return null;
          }
        }

        @NgModule({
          imports: [CommonModule],
          declarations: [ExamplePipe],
          exports: [ExamplePipe],
        })
        export class ExamplePipeModule {}
        "
      `);
    });

    it('should generate the module file with the "." type separator for versions lower than v20', async () => {
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

      await scamPipeGenerator(tree, {
        name: 'example',
        path: 'apps/app1/src/app/example/example',
        inlineScam: false,
        skipFormat: true,
      });

      expect(tree.read('apps/app1/src/app/example/example.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        import { ExamplePipe } from './example.pipe';

        @NgModule({
          imports: [CommonModule],
          declarations: [ExamplePipe],
          exports: [ExamplePipe],
        })
        export class ExamplePipeModule {}
        "
      `);
    });
  });
});
