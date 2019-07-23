import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';

import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

describe('Update 7.8.1', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = createEmptyWorkspace(Tree.empty());
    initialTree.overwrite(
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

  it('should update prettier', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.8.1', {}, initialTree)
      .toPromise();

    const { devDependencies } = JSON.parse(result.readContent('package.json'));

    expect(devDependencies.prettier).toEqual('1.16.4');
  });

  describe('.prettierignore', () => {
    it('should not be touched if one exists', async () => {
      initialTree.create('.prettierignore', '**/*.json');
      const result = await schematicRunner
        .runSchematicAsync('update-7.8.1', {}, initialTree)
        .toPromise();

      expect(result.readContent('.prettierignore')).toEqual('**/*.json');
    });
  });
});
