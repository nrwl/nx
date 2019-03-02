import { Tree } from '@angular-devkit/schematics';
import {
  SchematicTestRunner,
  UnitTestTree
} from '@angular-devkit/schematics/testing';

import { join } from 'path';
import { readJsonInTree } from '../../src/utils/ast-utils';

describe('Update 7.7.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = new UnitTestTree(Tree.empty());

    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      join(__dirname, '../migrations.json')
    );
  });

  describe('setting defaults to angular', () => {
    it('should set default lib framework to Angular', async () => {
      const result = await schematicRunner
        .runSchematicAsync('update-7.7.0', {}, initialTree)
        .toPromise();

      expect(
        readJsonInTree(result, 'angular.json').schematics[
          '@nrwl/schematics:library'
        ].framework
      ).toEqual('angular');
    });
  });
});
