import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import * as path from 'path';

describe('Move @types/react-redux Package 11.2.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@types/react-redux': '10.1.1',
        },
      })
    );
  });

  it(`should move @types/react-redux, if in deps, to the devDeps in package.json`, async () => {
    tree = await schematicRunner
      .runSchematicAsync('move-react-redux-types-package-11.2.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        '@types/react-redux': '10.1.1',
      },
    });
  });
});
