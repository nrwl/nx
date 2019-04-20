import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '@nrwl/workspace';

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

  it('should update prettier', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.1.0', {}, initialTree)
      .toPromise();

    const { devDependencies } = JSON.parse(result.readContent('package.json'));

    expect(devDependencies.prettier).toEqual('1.15.2');
  });

  describe('.prettierignore', () => {
    it('should not be touched if one exists', async () => {
      initialTree.create('.prettierignore', '**/*.json');
      const result = await schematicRunner
        .runSchematicAsync('update-7.1.0', {}, initialTree)
        .toPromise();

      expect(result.readContent('.prettierignore')).toEqual('**/*.json');
    });

    it('should be created if one does not exist', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-7.1.0', {}, initialTree)
        .toPromise();

      expect(result.exists('.prettierignore')).toEqual(true);
    });
  });
});
