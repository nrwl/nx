import 'nx/src/internal-testing-utils/mock-project-graph';

import * as devkit from '@nx/devkit';
import {
  addProjectConfiguration,
  joinPathFragments,
  type ProjectGraph,
  readJson,
  readProjectConfiguration,
  removeProjectConfiguration,
  type Tree,
  updateJson,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { UnitTestRunner } from '../../utils/test-runners';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import { generateTestLibrary } from '../utils/testing';
import { move } from './move-impl';

describe('move-impl (Angular plugin for @nx/workspace:move)', () => {
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

  // Mimics the file/config moves performed by `@nx/workspace:move` before it
  // invokes the Angular plugin: copies files to the new root, removes the old
  // project config, and re-registers the project under its new name with the
  // root rewritten in target paths.
  function relocateProject(
    oldProjectName: string,
    newProjectName: string,
    destination: string
  ): void {
    const oldConfig = readProjectConfiguration(tree, oldProjectName);
    const oldRoot = oldConfig.root;
    const oldProjectJson = joinPathFragments(oldRoot, 'project.json');

    visitNotIgnoredFiles(tree, oldRoot, (filePath) => {
      if (filePath === oldProjectJson) {
        return;
      }
      const newPath = destination + filePath.slice(oldRoot.length);
      tree.write(newPath, tree.read(filePath));
      tree.delete(filePath);
    });

    removeProjectConfiguration(tree, oldProjectName);

    const escapedOldRoot = oldRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rewritten = JSON.parse(
      JSON.stringify(oldConfig).replace(
        new RegExp(`(?<![\\w-])${escapedOldRoot}(?![\\w-])`, 'g'),
        destination
      )
    );
    addProjectConfiguration(tree, newProjectName, {
      ...rewritten,
      name: newProjectName,
    });
  }

  async function runAngularPlugin(
    oldProjectName: string,
    destination: string,
    newProjectName: string = oldProjectName
  ): Promise<void> {
    relocateProject(oldProjectName, newProjectName, destination);
    await move(tree, { oldProjectName, newProjectName });
  }

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await generateTestLibrary(tree, {
      directory: 'my-lib',
      buildable: false,
      linter: 'eslint',
      publishable: false,
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

    await runAngularPlugin('my-lib', 'mynewlib', 'mynewlib');

    expect(tree.exists('mynewlib/src/lib/mynewlib-module.ts')).toEqual(true);
  });

  it('should update ng-package.json dest property', async () => {
    await generateTestLibrary(tree, {
      directory: 'mylib2',
      buildable: true,
      skipFormat: true,
    });
    addProjectToGraph('mylib2');

    await runAngularPlugin('mylib2', 'mynewlib2');

    const ngPackageJson = readJson(tree, 'mynewlib2/ng-package.json');
    expect(ngPackageJson.dest).toEqual('../dist/mynewlib2');
  });

  it('should update secondary entry points readme file', async () => {
    await generateTestLibrary(tree, {
      directory: 'mylib2',
      buildable: true,
      skipFormat: true,
    });
    await librarySecondaryEntryPointGenerator(tree, {
      library: 'mylib2',
      name: 'testing',
      skipFormat: true,
    });
    addProjectToGraph('mylib2');

    await runAngularPlugin('mylib2', 'mynewlib2', 'mynewlib2');

    const readme = tree.read('mynewlib2/testing/README.md', 'utf-8');
    expect(readme).toMatchInlineSnapshot(`
      "# @proj/mynewlib2/testing

      Secondary entry point of \`@proj/mynewlib2\`. It can be used by importing from \`@proj/mynewlib2/testing\`.
      "
    `);
  });

  it('should handle nesting resulting in the same project name', async () => {
    addProjectToGraph('my-lib');

    await runAngularPlugin('my-lib', 'my/lib');

    expect(tree.exists('my/lib/src/lib/my-lib-module.ts')).toBe(true);
    const moduleFile = tree.read('my/lib/src/lib/my-lib-module.ts', 'utf-8');
    expect(moduleFile).toContain(`export class MyLibModule {}`);
  });

  describe('move to subfolder', () => {
    beforeEach(async () => {
      await generateTestLibrary(tree, {
        directory: 'my-lib2',
        buildable: false,
        linter: 'eslint',
        publishable: false,
        skipFormat: true,
        unitTestRunner: UnitTestRunner.Jest,
      });
      tree.write(
        'my-lib/src/lib/my-lib-module.ts',
        `import { NgModule } from '@angular/core';
    import { CommonModule } from '@angular/common';

    @NgModule({
      imports: [CommonModule]
    })
    export class MyLibModule {}`
      );

      tree.write(
        'my-lib/src/lib/my-lib-module.spec.ts',
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
        'my-lib2/src/lib/my-lib2-module.ts',
        `import { MyLibModule } from '@proj/my-lib';

      export class MyLib2Module extends MyLibModule {}
      `
      );
    });

    it('should rename the module files and update the module name', async () => {
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'shared/my-lib', 'shared-my-lib');

      expect(tree.exists('shared/my-lib/src/lib/shared-my-lib-module.ts')).toBe(
        true
      );
      expect(
        tree.exists('shared/my-lib/src/lib/shared-my-lib-module.spec.ts')
      ).toBe(true);

      const moduleFile = tree.read(
        'shared/my-lib/src/lib/shared-my-lib-module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class SharedMyLibModule {}`);

      const moduleSpecFile = tree.read(
        'shared/my-lib/src/lib/shared-my-lib-module.spec.ts',
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

    it('should rename the module class in importer files', async () => {
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'shared/my-lib', 'shared-my-lib');

      const importerFile = tree.read(
        'my-lib2/src/lib/my-lib2-module.ts',
        'utf-8'
      );
      expect(importerFile).toContain(`import { SharedMyLibModule }`);
      expect(importerFile).toContain(
        `export class MyLib2Module extends SharedMyLibModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'shared/my-lib', 'shared-my-lib');

      const indexFile = tree.read('shared/my-lib/src/index.ts', 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/shared-my-lib-module';`
      );
    });
  });

  describe('rename', () => {
    beforeEach(async () => {
      await generateTestLibrary(tree, {
        directory: 'my-importer',
        buildable: false,
        linter: 'eslint',
        publishable: false,
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

      await runAngularPlugin('my-lib', 'my-destination', 'my-destination');

      expect(
        tree.exists('my-destination/src/lib/my-destination-module.ts')
      ).toBe(true);

      const moduleFile = tree.read(
        'my-destination/src/lib/my-destination-module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class MyDestinationModule {}`);
    });

    it('should rename the module class in importer files', async () => {
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'my-destination', 'my-destination');

      const importerFile = tree.read(
        'my-importer/src/lib/my-importing-file.ts',
        'utf-8'
      );
      expect(importerFile).toContain(`import { MyDestinationModule }`);
      expect(importerFile).toContain(
        `export class MyExtendedLibModule extends MyDestinationModule {}`
      );
    });

    it('should update the index.ts file which exports the module', async () => {
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'my-destination', 'my-destination');

      const indexFile = tree.read('my-destination/src/index.ts', 'utf-8');
      expect(indexFile).toContain(
        `export * from './lib/my-destination-module';`
      );
    });

    it('should not rename unrelated symbols with similar name in different projects', async () => {
      // create different project whose main module name starts with the same
      // name of the project we're moving
      await generateTestLibrary(tree, {
        directory: 'my-lib-demo',
        buildable: false,
        linter: 'eslint',
        publishable: false,
        skipFormat: true,
        unitTestRunner: UnitTestRunner.Jest,
        standalone: false,
      });
      addProjectToGraph('my-lib');

      await runAngularPlugin('my-lib', 'my-destination', 'my-destination');

      const moduleFile = tree.read(
        'my-lib-demo/src/lib/my-lib-demo-module.ts',
        'utf-8'
      );
      expect(moduleFile).toContain(`export class MyLibDemoModule {}`);
    });
  });

  describe('legacy "." module type separator', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
    });

    it('should move project that uses "." module type separator', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.generators = {
          ...json.generators,
          '@nx/angular:module': {
            typeSeparator: '.',
          },
        };
        return json;
      });
      addProjectToGraph('my-lib');
      await generateTestLibrary(tree, {
        directory: 'my-lib',
        buildable: true,
        standalone: false,
        skipFormat: true,
      });

      await runAngularPlugin('my-lib', 'my-new-lib', 'my-new-lib');

      expect(tree.exists('my-lib/src/lib/my-lib.module.ts')).toBe(false);
      expect(tree.read('my-new-lib/src/lib/my-new-lib.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @NgModule({
          imports: [CommonModule],
        })
        export class MyNewLibModule {}
        "
      `);
      expect(tree.exists('my-lib/ng-package.json')).toBe(false);
      expect(tree.read('my-new-lib/ng-package.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "$schema": "../node_modules/ng-packagr/ng-package.schema.json",
          "dest": "../dist/my-new-lib",
          "lib": {
            "entryFile": "src/index.ts"
          }
        }
        "
      `);
    });

    it('should move project when angular version is lower than v20', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.dependencies = {
          ...json.dependencies,
          '@angular/core': '~19.2.0',
        };
        return json;
      });
      addProjectToGraph('my-lib');
      await generateTestLibrary(tree, {
        directory: 'my-lib',
        buildable: true,
        standalone: false,
        skipFormat: true,
      });

      await runAngularPlugin('my-lib', 'my-new-lib', 'my-new-lib');

      expect(tree.exists('my-lib/src/lib/my-lib.module.ts')).toBe(false);
      expect(tree.read('my-new-lib/src/lib/my-new-lib.module.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import { NgModule } from '@angular/core';
        import { CommonModule } from '@angular/common';

        @NgModule({
          imports: [CommonModule],
        })
        export class MyNewLibModule {}
        "
      `);
      expect(tree.exists('my-lib/ng-package.json')).toBe(false);
      expect(tree.read('my-new-lib/ng-package.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "$schema": "../node_modules/ng-packagr/ng-package.schema.json",
          "dest": "../dist/my-new-lib",
          "lib": {
            "entryFile": "src/index.ts"
          }
        }
        "
      `);
    });
  });
});
