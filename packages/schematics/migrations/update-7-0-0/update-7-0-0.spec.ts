import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { serializeJson } from '../../src/utils/fileutils';

import * as path from 'path';

describe('Update 7.0.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          codelyzer: '~4.2.1'
        }
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/schematics',
      path.join(__dirname, '../migrations.json')
    );
  });

  it('should update codeylzer', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-7.0.0', {}, initialTree)
      .toPromise();

    const devDependencies = JSON.parse(result.readContent('package.json'))
      .devDependencies;

    expect(devDependencies.codelyzer).toEqual('~4.5.0');
    expect(devDependencies['jasmine-marbles']).toEqual('0.4.0');
  });
});
