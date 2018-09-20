import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '../../src/utils/fileutils';

import * as path from 'path';

describe('Update 6.2.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          'jest-preset-angular': '6.0.0'
        }
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should update jest-preset-angular', () => {
    const result = schematicRunner.runSchematic(
      'update-6.3.2',
      {},
      initialTree
    );
    expect(JSON.parse(result.readContent('package.json'))).toEqual({
      devDependencies: {
        'jest-preset-angular': '6.0.1'
      }
    });
  });

  it('should not update jest-preset-angular if it does not exist', () => {
    initialTree.overwrite(
      'package.json',
      serializeJson({
        devDependencies: {}
      })
    );
    const result = schematicRunner.runSchematic(
      'update-6.3.2',
      {},
      initialTree
    );
    expect(JSON.parse(result.readContent('package.json'))).toEqual({
      devDependencies: {}
    });
  });
});
