import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createApp, createEmptyWorkspace } from '../testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';

describe('lib', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/schematics', path.join(__dirname, '../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);

    schematicRunner.logger.subscribe(s => console.log(s));
  });

  it('should update angular-cli.json', () => {
    const tree = schematicRunner.runSchematic('lib', { name: 'myLib' }, appTree);
    const updatedAngularCLIJson = JSON.parse(getFileContent(tree, '/.angular-cli.json'));
    expect(updatedAngularCLIJson.apps).toEqual([
      {
        appRoot: '',
        name: 'my-lib',
        root: 'libs/my-lib/src',
        test: '../../../test.js'
      }
    ]);
  });

  it('should generate files', () => {
    const tree = schematicRunner.runSchematic('lib', { name: 'myLib', nomodule: true }, appTree);
    expect(tree.exists('libs/my-lib/src/my-lib.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/my-lib.spec.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/index.ts')).toBeTruthy();
    expect(getFileContent(tree, 'libs/my-lib/src/my-lib.ts')).toContain('class MyLib');
  });

  it('should generate files', () => {
    const tree = schematicRunner.runSchematic('lib', { name: 'myLib' }, appTree);
    expect(tree.exists('libs/my-lib/src/my-lib.module.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/my-lib.module.spec.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/index.ts')).toBeTruthy();
    expect(getFileContent(tree, 'libs/my-lib/src/my-lib.module.ts')).toContain('class MyLibModule');
  });

  describe('router', () => {
    it('should error when routing is set with nomodule = true', () => {
      expect(() =>
        schematicRunner.runSchematic('lib', { name: 'myLib', nomodule: true, routing: true }, appTree)
      ).toThrow('nomodule and routing cannot be used together');
    });

    it('should error when lazy is set without routing', () => {
      expect(() => schematicRunner.runSchematic('lib', { name: 'myLib', lazy: true }, appTree)).toThrow(
        'routing must be set'
      );
    });

    describe('lazy', () => {
      it('should add RouterModule.forChild', () => {
        const tree = schematicRunner.runSchematic('lib', { name: 'myLib', routing: true, lazy: true }, appTree);
        expect(tree.exists('libs/my-lib/src/my-lib.module.ts')).toBeTruthy();
        expect(getFileContent(tree, 'libs/my-lib/src/my-lib.module.ts')).toContain('RouterModule.forChild');
      });

      it('should update the parent module', () => {
        appTree = createApp(appTree, 'myapp');
        const tree = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib', routing: true, lazy: true, parentModule: 'apps/myapp/src/app/app.module.ts' },
          appTree
        );
        expect(getFileContent(tree, 'apps/myapp/src/app/app.module.ts')).toContain(
          `RouterModule.forRoot([{path: 'my-lib', loadChildren: '@proj/my-lib#MyLibModule'}])`
        );

        const tree2 = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib2', routing: true, lazy: true, parentModule: 'apps/myapp/src/app/app.module.ts' },
          tree
        );
        expect(getFileContent(tree2, 'apps/myapp/src/app/app.module.ts')).toContain(
          `RouterModule.forRoot([{path: 'my-lib', loadChildren: '@proj/my-lib#MyLibModule'}, {path: 'my-lib2', loadChildren: '@proj/my-lib2#MyLib2Module'}])`
        );
      });

      it('should register the module as lazy loaded in tslint.json', () => {
        const tree = schematicRunner.runSchematic('lib', { name: 'myLib', routing: true, lazy: true }, appTree);
        const tslint = JSON.parse(getFileContent(tree, 'tslint.json'));
        expect(tslint['rules']['nx-enforce-module-boundaries'][1]['lazyLoad']).toEqual(['my-lib']);
      });
    });

    describe('eager', () => {
      it('should add RouterModule and define an array of routes', () => {
        const tree = schematicRunner.runSchematic('lib', { name: 'myLib', routing: true }, appTree);
        expect(tree.exists('libs/my-lib/src/my-lib.module.ts')).toBeTruthy();
        expect(getFileContent(tree, 'libs/my-lib/src/my-lib.module.ts')).toContain('RouterModule]');
        expect(getFileContent(tree, 'libs/my-lib/src/my-lib.module.ts')).toContain('const myLibRoutes: Route[] = ');
        expect(getFileContent(tree, 'libs/my-lib/index.ts')).toContain('myLibRoutes');
      });

      it('should update the parent module', () => {
        appTree = createApp(appTree, 'myapp');
        const tree = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib', routing: true, parentModule: 'apps/myapp/src/app/app.module.ts' },
          appTree
        );
        expect(getFileContent(tree, 'apps/myapp/src/app/app.module.ts')).toContain(
          `RouterModule.forRoot([{path: 'my-lib', children: myLibRoutes}])`
        );

        const tree2 = schematicRunner.runSchematic(
          'lib',
          { name: 'myLib2', routing: true, parentModule: 'apps/myapp/src/app/app.module.ts' },
          tree
        );
        expect(getFileContent(tree2, 'apps/myapp/src/app/app.module.ts')).toContain(
          `RouterModule.forRoot([{path: 'my-lib', children: myLibRoutes}, {path: 'my-lib2', children: myLib2Routes}])`
        );
      });
    });
  });
});
