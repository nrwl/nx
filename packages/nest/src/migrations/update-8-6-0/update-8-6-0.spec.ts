import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree, serializeJson } from '@nrwl/workspace';

import * as path from 'path';

describe('Update 8.6.0', () => {
  let initialTree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(() => {
    initialTree = Tree.empty();
    initialTree.create(
      'package.json',
      serializeJson({
        devDependencies: {
          '@nestjs/schematics': '^6.3.0',
          '@nestjs/testing': '^6.2.4'
        },
        dependencies: {
          '@nestjs/core': '^6.2.4',
          '@nestjs/common': '^6.2.4',
          '@nestjs/platform-express': '^6.2.4'
        }
      })
    );
    schematicRunner = new SchematicTestRunner(
      '@nrwl/nest',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it('should update nestjs', async () => {
    const result = await schematicRunner
      .runSchematicAsync('update-8-6-0', {}, initialTree)
      .toPromise();

    const { devDependencies, dependencies } = readJsonInTree(
      result,
      'package.json'
    );

    expect(devDependencies['@nestjs/schematics']).toEqual('6.4.4');
    expect(devDependencies['@nestjs/testing']).toEqual('6.7.1');
    expect(dependencies['@nestjs/core']).toEqual('6.7.1');
    expect(dependencies['@nestjs/common']).toEqual('6.7.1');
    expect(dependencies['@nestjs/platform-express']).toEqual('6.7.1');
  });
});
