import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';

import * as path from 'path';

import { serializeJson } from '@nrwl/workspace';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update 7.5.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());

    initialTree.overwrite(
      'package.json',
      serializeJson({
        devDependencies: {
          typescript: '~3.1.0'
        }
      })
    );

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should update typescript', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.5.0', {}, initialTree)
      .toPromise();

    expect(
      readJsonInTree(result, 'package.json').devDependencies.typescript
    ).toEqual('~3.2.2');
  });
});
