import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';

describe('app', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/schematics', path.join(__dirname, '../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should update angular-cli.json', () => {
    const tree = schematicRunner.runSchematic('app', { name: 'myApp' }, appTree);
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
        tsconfig: '../../../tsconfig.app.json'
      }
    ]);
  });

  it('should generate files', () => {
    const tree = schematicRunner.runSchematic('app', { name: 'myAPp' }, appTree);
    expect(tree.exists('apps/my-app/src/main.ts')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/app/app.module.ts')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/app/app.component.ts')).toBeTruthy();
    expect(tree.exists('apps/my-app/e2e/app.po.ts')).toBeTruthy();
    expect(getFileContent(tree, 'apps/my-app/src/app/app.module.ts')).toContain('class AppModule');
  });

  it('should import NgModule', () => {
    const tree = schematicRunner.runSchematic('app', { name: 'myApp' }, appTree);
    expect(getFileContent(tree, 'apps/my-app/src/app/app.module.ts')).toContain('NxModule.forRoot()');
  });
});
