import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../../../../shared/testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';
import * as stripJsonComments from 'strip-json-comments';

describe('app', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/bazel', path.join(__dirname, '../../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('not nested', () => {
    it('should update angular-cli.json', () => {
      const tree = schematicRunner.runSchematic('app', { name: 'myApp', npmScope: 'nrwl' }, appTree);
      const updatedAngularCLIJson = JSON.parse(getFileContent(tree, '/.angular-cli.json'));
      expect(updatedAngularCLIJson.apps).toEqual([
        {
          assets: ['assets', 'favicon.ico'],
          environmentSource: 'environments/environment.ts',
          environments: { dev: 'environments/environment.ts', prod: 'environments/environment.prod.ts' },
          index: 'index.html',
          main: 'main.ts',
          name: 'my-app',
          outDir: 'dist/apps/my-app',
          polyfills: 'polyfills.ts',
          prefix: 'app',
          root: 'apps/my-app/src',
          scripts: [],
          styles: ['styles.css'],
          test: '../../../test.js',
          testTsconfig: '../../../tsconfig.spec.json',
          tsconfig: 'tsconfig.app.json'
        }
      ]);
      expect(updatedAngularCLIJson.lint).toEqual([
        {
          project: `apps/my-app/src/tsconfig.app.json`,
          exclude: '**/node_modules/**'
        },
        {
          project: `apps/my-app/e2e/tsconfig.e2e.json`,
          exclude: '**/node_modules/**'
        }
      ]);
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic('app', { name: 'myApp', npmScope: 'nrwl' }, appTree);
      expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/src/app/app.component.ts')).toBeTruthy();
      expect(tree.exists('apps/my-app/e2e/app.po.ts')).toBeTruthy();
      expect(getFileContent(tree, 'apps/my-app/src/app/app.module.ts')).toContain('class AppModule');

      const tsconfigApp = JSON.parse(stripJsonComments(getFileContent(tree, 'apps/my-app/src/tsconfig.app.json')));
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../../dist/out-tsc/apps/my-app');

      const tsconfigE2E = JSON.parse(stripJsonComments(getFileContent(tree, 'apps/my-app/e2e/tsconfig.e2e.json')));
      expect(tsconfigE2E.compilerOptions.outDir).toEqual('../../../dist/out-tsc/e2e/my-app');
    });
  });

  describe('nested', () => {
    it('should update angular-cli.json', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', npmScope: 'nrwl', directory: 'myDir' },
        appTree
      );
      const updatedAngularCLIJson = JSON.parse(getFileContent(tree, '/.angular-cli.json'));
      expect(updatedAngularCLIJson.apps).toEqual([
        {
          assets: ['assets', 'favicon.ico'],
          environmentSource: 'environments/environment.ts',
          environments: { dev: 'environments/environment.ts', prod: 'environments/environment.prod.ts' },
          index: 'index.html',
          main: 'main.ts',
          name: 'my-dir/my-app',
          outDir: 'dist/apps/my-dir/my-app',
          polyfills: 'polyfills.ts',
          prefix: 'app',
          root: 'apps/my-dir/my-app/src',
          scripts: [],
          styles: ['styles.css'],
          test: '../../../../test.js',
          testTsconfig: '../../../../tsconfig.spec.json',
          tsconfig: 'tsconfig.app.json'
        }
      ]);

      expect(updatedAngularCLIJson.lint).toEqual([
        {
          project: `apps/my-dir/my-app/src/tsconfig.app.json`,
          exclude: '**/node_modules/**'
        },
        {
          project: `apps/my-dir/my-app/e2e/tsconfig.e2e.json`,
          exclude: '**/node_modules/**'
        }
      ]);
    });

    it('should generate files', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', npmScope: 'nrwl', directory: 'myDir' },
        appTree
      );
      expect(tree.exists('apps/my-dir/my-app/src/main.ts')).toBeTruthy();
      expect(tree.exists('apps/my-dir/my-app/src/app/app.module.ts')).toBeTruthy();
      expect(tree.exists('apps/my-dir/my-app/src/app/app.component.ts')).toBeTruthy();
      expect(tree.exists('apps/my-dir/my-app/e2e/app.po.ts')).toBeTruthy();
      expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.module.ts')).toContain('class AppModule');

      const tsconfigApp = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-dir/my-app/src/tsconfig.app.json'))
      );
      expect(tsconfigApp.compilerOptions.outDir).toEqual('../../../../dist/out-tsc/apps/my-dir/my-app');

      const tsconfigE2E = JSON.parse(
        stripJsonComments(getFileContent(tree, 'apps/my-dir/my-app/e2e/tsconfig.e2e.json'))
      );
      expect(tsconfigE2E.compilerOptions.outDir).toEqual('../../../../dist/out-tsc/e2e/my-dir/my-app');
    });
  });

  it('should import NgModule', () => {
    const tree = schematicRunner.runSchematic('app', { name: 'myApp', npmScope: 'nrwl', directory: 'myDir' }, appTree);
    expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.module.ts')).toContain('NxModule.forRoot()');
  });

  describe('routing', () => {
    it('should include RouterTestingModule', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', npmScope: 'nrwl', directory: 'myDir', routing: true },
        appTree
      );
      expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.module.ts')).toContain('RouterModule.forRoot');
      expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.spec.ts')).toContain(
        'imports: [RouterTestingModule]'
      );
    });
  });

  describe('view encapsulation', () => {
    it('should not set Component encapsulation metadata if option flag not included', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', npmScope: 'nrwl', directory: 'myDir' },
        appTree
      );
      expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.ts')).not.toContain('encapsulation: ');
    });
    it('should set Component encapsulation metadata if option flag is included', () => {
      const tree = schematicRunner.runSchematic(
        'app',
        { name: 'myApp', npmScope: 'nrwl', directory: 'myDir', viewEncapsulation: 'Native' },
        appTree
      );
      expect(getFileContent(tree, 'apps/my-dir/my-app/src/app/app.component.ts')).toContain(
        'encapsulation: ViewEncapsulation.Native'
      );
    });
  });
});
