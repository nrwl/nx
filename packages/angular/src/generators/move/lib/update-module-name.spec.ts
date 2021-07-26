import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { moveGenerator } from '@nrwl/workspace';
import { Schema } from '../schema';
import { updateModuleName } from './update-module-name';
import libraryGenerator from '../../library/library';
import { Linter } from '@nrwl/linter';
import { UnitTestRunner } from '../../../utils/test-runners';

describe('updateModuleName Rule', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should handle nesting resulting in the same project name', async () => {
    const updatedModulePath = '/libs/my/first/src/lib/my-first.module.ts';
    await libraryGenerator(tree, {
      name: 'my-first',
      simpleModuleName: true,
    });
    const schema: Schema = {
      projectName: 'my-first',
      destination: 'my/first',
      updateImportPath: true,
    };
    await moveGenerator(tree, schema);

    updateModuleName(tree, { ...schema, destination: 'my/first' });

    expect(tree.exists(updatedModulePath)).toBe(true);
    const moduleFile = tree.read(updatedModulePath).toString('utf-8');
    expect(moduleFile).toContain(`export class MyFirstModule { }`);
  });

  describe('move to subfolder', () => {
    const updatedModulePath =
      '/libs/shared/my-first/src/lib/shared-my-first.module.ts';
    const updatedModuleSpecPath =
      '/libs/shared/my-first/src/lib/shared-my-first.module.spec.ts';
    const indexPath = '/libs/shared/my-first/src/index.ts';
    const secondModulePath = '/libs/my-second/src/lib/my-second.module.ts';

    const schema: Schema = {
      projectName: 'my-first',
      destination: 'shared/my-first',
      updateImportPath: true,
    };

    beforeEach(async () => {
      await libraryGenerator(tree, {
        name: 'my-first',
        buildable: false,
        enableIvy: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleModuleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });
      await libraryGenerator(tree, {
        name: 'my-second',
        buildable: false,
        enableIvy: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleModuleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });
      tree.write(
        '/libs/my-first/src/lib/my-first.module.ts',
        `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @NgModule({
      imports: [CommonModule]
    })
    export class MyFirstModule {}`
      );

      tree.write(
        '/libs/my-first/src/lib/my-first.module.spec.ts',
        `import { async, TestBed } from '@angular/core/testing';
    import { MyFirstModule } from './my-first.module';

    describe('MyFirstModule', () => {
      beforeEach(async(() => {
        TestBed.configureTestingModule({
          imports: [MyFirstModule]
        }).compileComponents();
      }));

      it('should create', () => {
        expect(MyFirstModule).toBeDefined();
      });
    });`
      );
      tree.write(
        secondModulePath,
        `import { MyFirstModule } from '@proj/my-first';

      export class MySecondModule extends MyFirstModule {}
      `
      );
      await moveGenerator(tree, schema);
    });

    it('should rename the module files and update the module name', async () => {
      updateModuleName(tree, schema);

      expect(tree.exists(updatedModulePath)).toBe(true);
      expect(tree.exists(updatedModuleSpecPath)).toBe(true);

      const moduleFile = tree.read(updatedModulePath).toString('utf-8');
      expect(moduleFile).toContain(`export class SharedMyFirstModule {}`);

      const moduleSpecFile = tree.read(updatedModuleSpecPath).toString('utf-8');
      expect(moduleSpecFile).toContain(
        `import { SharedMyFirstModule } from './shared-my-first.module';`
      );
      expect(moduleSpecFile).toContain(
        `describe('SharedMyFirstModule', () => {`
      );
      expect(moduleSpecFile).toContain(`imports: [SharedMyFirstModule]`);
      expect(moduleSpecFile).toContain(
        `expect(SharedMyFirstModule).toBeDefined();`
      );
    });

    it('should update any references to the module', async () => {
      updateModuleName(tree, schema);

      const importerFile = tree.read(secondModulePath).toString('utf-8');
      expect(importerFile).toContain(
        `import { SharedMyFirstModule } from '@proj/shared-my-first';`
      );
      expect(importerFile).toContain(
        `export class MySecondModule extends SharedMyFirstModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      updateModuleName(tree, schema);

      const indexFile = tree.read(indexPath).toString('utf-8');
      expect(indexFile).toContain(
        `export * from './lib/shared-my-first.module';`
      );
    });
  });

  describe('rename', () => {
    const schema: Schema = {
      projectName: 'my-source',
      destination: 'my-destination',
      updateImportPath: true,
    };

    const modulePath = '/libs/my-destination/src/lib/my-destination.module.ts';
    const moduleSpecPath =
      '/libs/my-destination/src/lib/my-destination.module.spec.ts';
    const indexPath = '/libs/my-destination/src/index.ts';
    const importerPath = '/libs/my-importer/src/lib/my-importing-file.ts';

    beforeEach(async () => {
      // fake a mid-move tree:
      await libraryGenerator(tree, {
        name: 'my-destination',
        buildable: false,
        enableIvy: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleModuleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });

      tree.write(
        '/libs/my-destination/src/lib/my-source.module.ts',
        `import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';
        @NgModule({
          imports: [CommonModule]
        })
        export class MySourceModule {}`
      );

      tree.write(
        '/libs/my-destination/src/lib/my-source.module.spec.ts',
        `import { async, TestBed } from '@angular/core/testing';
        import { MySourceModule } from './my-source.module';
        describe('MySourceModule', () => {
          beforeEach(async(() => {
            TestBed.configureTestingModule({
              imports: [MySourceModule]
            }).compileComponents();
          }));
          it('should create', () => {
            expect(MySourceModule).toBeDefined();
          });
        });`
      );

      tree.write(
        indexPath,
        `export * from './lib/my-source.module';
        `
      );

      tree.delete(modulePath);
      tree.delete(moduleSpecPath);

      await libraryGenerator(tree, {
        name: 'my-importer',
        buildable: false,
        enableIvy: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleModuleName: true,
        skipFormat: false,
        unitTestRunner: UnitTestRunner.Jest,
      });

      tree.write(
        importerPath,
        `import { MySourceModule } from '@proj/my-destination';
          export class MyExtendedSourceModule extends MySourceModule {}
          `
      );
    });

    it('should rename the module files and update the module name', async () => {
      updateModuleName(tree, schema);

      expect(tree.exists(modulePath)).toBe(true);
      expect(tree.exists(moduleSpecPath)).toBe(true);

      const moduleFile = tree.read(modulePath).toString('utf-8');
      expect(moduleFile).toContain(`export class MyDestinationModule {}`);

      const moduleSpecFile = tree.read(moduleSpecPath).toString('utf-8');
      expect(moduleSpecFile).toContain(
        `import { MyDestinationModule } from './my-destination.module';`
      );
      expect(moduleSpecFile).toContain(
        `describe('MyDestinationModule', () => {`
      );
      expect(moduleSpecFile).toContain(`imports: [MyDestinationModule]`);
      expect(moduleSpecFile).toContain(
        `expect(MyDestinationModule).toBeDefined();`
      );
    });

    it('should update any references to the module', async () => {
      updateModuleName(tree, schema);

      const importerFile = tree.read(importerPath).toString('utf-8');
      expect(importerFile).toContain(
        `import { MyDestinationModule } from '@proj/my-destination';`
      );
      expect(importerFile).toContain(
        `export class MyExtendedSourceModule extends MyDestinationModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      updateModuleName(tree, schema);

      const indexFile = tree.read(indexPath).toString('utf-8');
      expect(indexFile).toContain(
        `export * from './lib/my-destination.module';`
      );
    });
  });
});
