import { addProjectConfiguration } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { convertPipeToScam } from './convert-pipe-to-scam';

describe('convertPipeToScam', () => {
  it('should create the scam pipe inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app/example',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/example/example.pipe.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        flat: false,
        inlineScam: true,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const pipeSource = tree.read(
      'apps/app1/src/app/example/example.pipe.ts',
      'utf-8'
    );
    expect(pipeSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example'
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
      export class ExamplePipeModule {}"
    `);
  });

  it('should create the scam pipe separately correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app/example',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/example/example.pipe.ts',
      },
      {
        name: 'example',
        project: 'app1',
        export: false,
        flat: false,
        inlineScam: false,
        path: 'apps/app1/src/app',
        projectSourceRoot: 'apps/app1/src',
      }
    );

    // ASSERT
    const pipeModuleSource = tree.read(
      'apps/app1/src/app/example/example.module.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExamplePipe } from './example.pipe';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}"
    `);
  });

  it('should create the scam pipe inline correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/example.pipe.ts',
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
    const pipeSource = tree.read('apps/app1/src/app/example.pipe.ts', 'utf-8');
    expect(pipeSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example'
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
      export class ExamplePipeModule {}"
    `);
  });

  it('should create the scam pipe separately correctly when --flat', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/example.pipe.ts',
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
    const pipeModuleSource = tree.read(
      'apps/app1/src/app/example.module.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';
      import { ExamplePipe } from './example.pipe';

      @NgModule({
        imports: [CommonModule],
        declarations: [ExamplePipe],
        exports: [ExamplePipe],
      })
      export class ExamplePipeModule {}"
    `);
  });

  it('should place the pipe and scam pipe in the correct folder when --path is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app/random/example',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/random/example/example.pipe.ts',
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
    const pipeModuleSource = tree.read(
      'apps/app1/src/app/random/example/example.pipe.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example'
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
      export class ExamplePipeModule {}"
    `);
  });

  it('should place the pipe and scam pipe in the correct folder when --path and --flat is used', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularPipeSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularPipeSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
      path: 'apps/app1/src/app/random',
    });

    // ACT
    convertPipeToScam(
      tree,
      {
        directory: 'apps/app1/src/app/random',
        fileName: 'example.pipe',
        filePath: 'apps/app1/src/app/random/example.pipe.ts',
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
    const pipeModuleSource = tree.read(
      'apps/app1/src/app/random/example.pipe.ts',
      'utf-8'
    );
    expect(pipeModuleSource).toMatchInlineSnapshot(`
      "import { Pipe, PipeTransform, NgModule } from '@angular/core';
      import { CommonModule } from '@angular/common';

      @Pipe({
        name: 'example'
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
      export class ExamplePipeModule {}"
    `);
  });
});
