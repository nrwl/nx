import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import type { Tree } from '@nrwl/tao/src/shared/tree';
import { join } from 'path';

import removeBabelRelatedPackages from './remove-babel-related-packages';

describe('update 12.7.3', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schematicRunner = new SchematicTestRunner(
      '@nrwl/jest',
      join(__dirname, '../../../migrations.json')
    );
  });

  test(`Babel related packages should be removed from devDeps in package.json`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        devDependencies: {
          '@babel/core': '7.12.13',
          '@babel/preset-env': '7.12.13',
          '@babel/preset-typescript': '7.12.13',
          '@babel/preset-react': '7.12.13',
        },
      })
    );
    await removeBabelRelatedPackages(tree);

    const packageJson = readJson(tree, '/package.json');
    expect(packageJson).toMatchObject({
      devDependencies: {},
    });
  });
});
