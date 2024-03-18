import * as devkit from '@nx/devkit';
import { ProjectGraph, readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { UnitTestRunner } from '../../utils/test-runners';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestLibrary } from '../utils/testing';
import { angularMoveGenerator } from './move';

describe('@nx/angular:move', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  function addProjectToGraph(project: string): void {
    projectGraph = {
      dependencies: {
        [project]: [
          { source: project, target: 'npm:@angular/core', type: 'static' },
        ],
      },
      nodes: {
        [project]: {
          name: project,
          type: 'lib',
          data: { root: project, targets: {} },
        },
      },
    };
  }

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    await generateTestLibrary(tree, {
      name: 'my-lib',
      buildable: false,
      linter: Linter.EsLint,
      publishable: false,
      simpleName: true,
      skipFormat: true,
      unitTestRunner: UnitTestRunner.Jest,
      standalone: false,
    });

    jest
      .spyOn(devkit, 'createProjectGraphAsync')
      .mockImplementation(() => Promise.resolve(projectGraph));
  });

  it('should move a project', async () => {
    addProjectToGraph('my-lib');

    await angularMoveGenerator(tree, {
      projectName: 'my-lib',
      newProjectName: 'mynewlib',
      destination: 'mynewlib',
      updateImportPath: true,
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });

    expect(tree.exists('mynewlib/src/lib/mynewlib.module.ts')).toEqual(true);
  });

  it('should update ng-package.json dest property', async () => {
    await generateTestLibrary(tree, {
      name: 'mylib2',
      buildable: true,
      skipFormat: true,
    });
    addProjectToGraph('mylib2');

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      destination: 'mynewlib2',
      updateImportPath: true,
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });

    const ngPackageJson = readJson(tree, 'mynewlib2/ng-package.json');
    expect(ngPackageJson.dest).toEqual('../dist/mynewlib2');
  });

  it('should update secondary entry points readme file', async () => {
    await generateTestLibrary(tree, {
      name: 'mylib2',
      buildable: true,
      skipFormat: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      library: 'mylib2',
      name: 'testing',
      skipFormat: true,
    });
    addProjectToGraph('mylib2');

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      newProjectName: 'mynewlib2',
      destination: 'mynewlib2',
      updateImportPath: true,
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });

    const readme = tree.read('mynewlib2/testing/README.md', 'utf-8');
    expect(readme).toMatchInlineSnapshot(`
      "# @proj/mynewlib2/testing

      Secondary entry point of \`@proj/mynewlib2\`. It can be used by importing from \`@proj/mynewlib2/testing\`.
      "
    `);
  });

  it('should handle nesting resulting in the same project name', async () => {
    addProjectToGraph('my-lib');

    await angularMoveGenerator(tree, {
      projectName: 'my-lib',
      destination: 'my/lib',
      updateImportPath: true,
      projectNameAndRootFormat: 'as-provided',
      skipFormat: true,
    });

    expect(tree.exists('my/lib/src/lib/my-lib.module.ts')).toBe(true);
    const moduleFile = tree.read('my/lib/src/lib/my-lib.module.ts', 'utf-8');
    expect(moduleFile).toContain(`export class MyLibModule {}`);
  });

  describe('move to subfolder', () => {
    beforeEach(async () => {
      await generateTestLibrary(tree, {
        name: 'my-lib2',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: true,
        unitTestRunner: UnitTestRunner.Jest,
      });
      tree.write(
        'my-lib/src/lib/my-lib.module.ts',
        `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @NgModule({
      imports: [CommonModule]
    })
    export class MyLibModule {}`
      );

      tree.write(
        'my-lib/src/lib/my-lib.module.spec.ts',
        `import { async, TestBed } from '@angular/core/testing';
    import { MyLibModule } from './my-lib.module';

    describe('MyLibModule', () => {
      beforeEach(async(() => {
        TestBed.configureTestingModule({
          imports: [MyLibModule]
        }).compileComponents();
      }));

      it('should create', () => {
        expect(MyLibModule).toBeDefined();
      });
    });`
      );
      tree.write(
        'my-lib2/src/lib/my-lib2.module.ts',
        `import { MyLibModule } from '@proj/my-lib';

      export class MyLib2Module extends MyLibModule {}
      `
      );
    });

    it('should rename the module files and update the module name', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'shared-my-lib',
        destination: 'shared/my-lib',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      expect(tree.exists('shared/my-lib/src/lib/shared-my-lib.module.ts')).toBe(
        true
      );
      expect(
        tree.exists('shared/my-lib/src/lib/shared-my-lib.module.spec.ts')
      ).toBe(true);

      const moduleFile = tree.read(
        'shared/my-lib/src/lib/shared-my-lib.module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class SharedMyLibModule {}`);

      const moduleSpecFile = tree.read(
        'shared/my-lib/src/lib/shared-my-lib.module.spec.ts',
        'utf-8'
      );
      expect(moduleSpecFile).toContain(
        `import { SharedMyLibModule } from './shared-my-lib.module';`
      );
      expect(moduleSpecFile).toContain(`describe('SharedMyLibModule', () => {`);
      expect(moduleSpecFile).toContain(`imports: [SharedMyLibModule]`);
      expect(moduleSpecFile).toContain(
        `expect(SharedMyLibModule).toBeDefined();`
      );
    });

    it('should update any references to the module', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'shared-my-lib',
        destination: 'shared/my-lib',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      const importerFile = tree.read(
        'my-lib2/src/lib/my-lib2.module.ts',
        'utf-8'
      );
      expect(importerFile).toContain(
        `import { SharedMyLibModule } from '@proj/shared-my-lib';`
      );
      expect(importerFile).toContain(
        `export class MyLib2Module extends SharedMyLibModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'shared-my-lib',
        destination: 'shared/my-lib',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      const indexFile = tree.read('shared/my-lib/src/index.ts', 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/shared-my-lib.module';`
      );
    });
  });

  describe('rename', () => {
    beforeEach(async () => {
      await generateTestLibrary(tree, {
        name: 'my-importer',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: true,
        unitTestRunner: UnitTestRunner.Jest,
      });

      tree.write(
        'my-importer/src/lib/my-importing-file.ts',
        `import { MyLibModule } from '@proj/my-lib';
          export class MyExtendedLibModule extends MyLibModule {}
          `
      );
    });

    it('should rename the module file and update the module name', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'my-destination',
        destination: 'my-destination',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      expect(
        tree.exists('my-destination/src/lib/my-destination.module.ts')
      ).toBe(true);

      const moduleFile = tree.read(
        'my-destination/src/lib/my-destination.module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class MyDestinationModule {}`);
    });

    it('should update any references to the module', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'my-destination',
        destination: 'my-destination',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      const importerFile = tree.read(
        'my-importer/src/lib/my-importing-file.ts',
        'utf-8'
      );
      expect(importerFile).toContain(
        `import { MyDestinationModule } from '@proj/my-destination';`
      );
      expect(importerFile).toContain(
        `export class MyExtendedLibModule extends MyDestinationModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'my-destination',
        destination: 'my-destination',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      const indexFile = tree.read('my-destination/src/index.ts', 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/my-destination.module';`
      );
    });

    it('should not rename unrelated symbols with similar name in different projects', async () => {
      // create different project whose main module name starts with the same
      // name of the project we're moving
      await generateTestLibrary(tree, {
        name: 'my-lib-demo',
        buildable: false,
        linter: Linter.EsLint,
        publishable: false,
        simpleName: true,
        skipFormat: true,
        unitTestRunner: UnitTestRunner.Jest,
        standalone: false,
      });
      addProjectToGraph('my-lib');

      await angularMoveGenerator(tree, {
        projectName: 'my-lib',
        newProjectName: 'my-destination',
        destination: 'my-destination',
        updateImportPath: true,
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
      });

      const moduleFile = tree.read(
        'my-lib-demo/src/lib/my-lib-demo.module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class MyLibDemoModule {}`);
    });
  });

  it('should move project correctly when --project-name-and-root-format=derived', async () => {
    await generateTestLibrary(tree, {
      name: 'mylib2',
      buildable: true,
      standalone: false,
      skipFormat: true,
    });
    addProjectToGraph('mylib2');

    await angularMoveGenerator(tree, {
      projectName: 'mylib2',
      destination: 'mynewlib',
      updateImportPath: true,
      projectNameAndRootFormat: 'derived',
      skipFormat: true,
    });

    expect(tree.exists('libs/mynewlib/src/lib/mynewlib.module.ts')).toEqual(
      true
    );
    const ngPackageJson = readJson(tree, 'libs/mynewlib/ng-package.json');
    expect(ngPackageJson.dest).toEqual('../../dist/libs/mynewlib');
  });
});
