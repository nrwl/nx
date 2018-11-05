import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '../../src/utils/fileutils';

import * as path from 'path';

describe('Update 7.1.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        scripts: {}
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should add generic affected script', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.1.0', {}, initialTree)
      .toPromise();

    const { scripts } = JSON.parse(result.readContent('package.json'));

    expect(scripts.affected).toEqual('./node_modules/.bin/nx affected');
  });
});
