import { readJson, Tree } from '@nrwl/devkit';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import * as path from 'path';
import { removeReactReduxTypesFromPackageJson } from './remove-react-redux-types-package';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('Remove @types/react-redux Package from package.json 12.0.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schematicRunner = new SchematicTestRunner(
      '@nrwl/react',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should remove @types/react-redux from deps and/or from devDeps in package.json`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@types/react-redux': '10.1.1',
        },
        devDependencies: {
          '@types/react-redux': '10.1.1',
        },
      })
    );
    await removeReactReduxTypesFromPackageJson(tree);

    const packageJson = readJson(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {},
    });
  });
});
