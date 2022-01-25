import { addProjectConfiguration, logger } from '@nrwl/devkit';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createScamPipe } from './create-module';

describe('Create module in the tree', () => {
  it('should create the scam pipe inline correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
      flat: false,
    });

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

  it('should warn when export called for app project', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app1', {
      projectType: 'application',
      sourceRoot: 'apps/app1/src',
      root: 'apps/app1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    const mockLoggerWarn = jest.spyOn(logger, 'warn');

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
      flat: false,
      export: true,
    });

    // ASSERT
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '--export=true was ignored as the project the SCAM is being generated in is not a library.'
    );
  });

  it('should create the scam pipe inline and export it correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'lib1',
      skipImport: true,
      export: false,
      flat: false,
    });

    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'lib1',
      inlineScam: true,
      flat: false,
      export: true,
    });

    // ASSERT
    const pipeSource = tree.read(
      'libs/lib1/src/lib/example/example.pipe.ts',
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

    const entryPointSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(entryPointSource).toMatchInlineSnapshot(`
      "
        export * from \\"./lib/example/example.pipe\\";"
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

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: false,
    });

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: false,
      flat: false,
    });

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

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: true,
      flat: true,
    });

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

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
    );
    await angularComponentSchematic(tree, {
      name: 'example',
      project: 'app1',
      skipImport: true,
      export: false,
      flat: true,
    });

    // ACT
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      inlineScam: false,
      flat: true,
    });

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

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
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
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      flat: false,
      path: 'apps/app1/src/app/random',
      inlineScam: true,
    });

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

    const angularComponentSchematic = wrapAngularDevkitSchematic(
      '@schematics/angular',
      'pipe'
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
    createScamPipe(tree, {
      name: 'example',
      project: 'app1',
      flat: true,
      path: 'apps/app1/src/app/random',
      inlineScam: true,
    });

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
