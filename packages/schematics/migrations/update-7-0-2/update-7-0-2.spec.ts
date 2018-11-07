import { Tree, mergeWith, url } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

import * as path from 'path';
import { readFileSync } from 'fs';

describe('Update 7.0.2', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    initialTree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should changeAutoWatch to true in the shared karma.conf.js', async () => {
    initialTree.create(
      'karma.conf.js',
      readFileSync(
        path.join(__dirname, './test-files/karma.conf.js')
      ).toString()
    );

    const result = await schematicRunner
      .runSchematicAsync('update-7.0.2', {}, initialTree)
      .toPromise();

    expect(result.readContent('karma.conf.js')).toContain('autoWatch: true');
  });
});
