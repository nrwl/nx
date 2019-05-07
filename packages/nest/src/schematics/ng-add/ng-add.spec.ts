import { Tree, VirtualTree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { readJsonInTree } from '@nrwl/workspace';

describe('ng-add', () => {
  let tree: Tree;
  let testRunner: SchematicTestRunner;

  beforeEach(() => {
    tree = new VirtualTree();
    tree = createEmptyWorkspace(tree);
    testRunner = new SchematicTestRunner(
      '@nrwl/nest',
      join(__dirname, '../../../collection.json')
    );
  });

  it('should add dependencies', async () => {
    const result = await testRunner
      .runSchematicAsync('ng-add', {}, tree)
      .toPromise();
    const packageJson = readJsonInTree(result, 'package.json');

    expect(packageJson.dependencies['@nrwl/nest']).toBeUndefined();
    expect(packageJson.devDependencies['@nrwl/nest']).toBeDefined();
    expect(packageJson.dependencies['@nestjs/core']).toBeDefined();
  });
});
