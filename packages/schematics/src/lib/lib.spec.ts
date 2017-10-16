import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '../testing-utils';
import { getFileContent } from '@schematics/angular/utility/test';

describe('lib', () => {
  const schematicRunner = new SchematicTestRunner('@nrwl/schematics', path.join(__dirname, '../collection.json'));

  let appTree: Tree;

  beforeEach(() => {
    appTree = new VirtualTree();
    appTree = createEmptyWorkspace(appTree);
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
    const tree = schematicRunner.runSchematic('lib', { name: 'myLib' }, appTree);
    expect(tree.exists('libs/my-lib/src/my-lib.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/my-lib.spec.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/index.ts')).toBeTruthy();
    expect(getFileContent(tree, 'libs/my-lib/src/my-lib.ts')).toContain('class MyLib');
  });

  it('should generate files (--ngmodule)', () => {
    const tree = schematicRunner.runSchematic('lib', { name: 'myLib', ngmodule: true }, appTree);
    expect(tree.exists('libs/my-lib/src/my-lib.module.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/my-lib.module.spec.ts')).toBeTruthy();
    expect(tree.exists('libs/my-lib/index.ts')).toBeTruthy();
    expect(getFileContent(tree, 'libs/my-lib/src/my-lib.module.ts')).toContain('class MyLibModule');
  });
});
