import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

import * as path from 'path';

import { serializeJson } from '../../src/utils/fileutils';
import { readJsonInTree } from '../../src/utils/ast-utils';

describe('Update 7.2.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();

    initialTree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          '@angular/cli': '7.1.0',
          typescript: '~3.1.0'
        }
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should update typescript and cli', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.4.0', {}, initialTree)
      .toPromise();

    expect(readJsonInTree(result, 'package.json')).toEqual({
      devDependencies: {
        '@angular/cli': '7.2.2',
        typescript: '~3.2.2'
      }
    });
  });
});
