import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import type { Tree } from '@nrwl/tao/src/shared/tree';
import { join } from 'path';

import { removeDocumentRegisterElementPackage } from './remove-document-register-element-package';

describe('update 12.7.3', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    schematicRunner = new SchematicTestRunner(
      '@nrwl/web',
      join(__dirname, '../../../migrations.json')
    );
  });

  test(`document-register-element package should be removed from deps in package.json`, async () => {
    tree.write(
      'package.json',
      JSON.stringify({
        dependencies: {
          'document-register-element': '1.13.1',
        },
      })
    );
    await removeDocumentRegisterElementPackage(tree);

    const packageJson = readJson(tree, '/package.json');
    expect(packageJson).toMatchObject({
      dependencies: {},
    });
  });
});
