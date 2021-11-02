import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { createLibWithTests } from '../../utils/testing';

describe('Update 8.5.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  const jestBuilder = '@nrwl/jest:jest';
  const nonJestBuilder = 'something-else';

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/workspace',
      join(__dirname, '../../../migrations.json')
    );
  });

  describe('When fixing tsconfig.lib.json files', () => {
    const schematicName = 'fix-tsconfig-lib-json';

    it('should not modify non jest projects', async () => {
      const lib = 'non-jest-lib';
      const exclude = [`src/test.ts`, '**/*.spec.ts'];

      tree = await createLibWithTests(tree, lib, nonJestBuilder, 'test.ts');
      tree.create(
        `/libs/${lib}/tsconfig.lib.json`,
        JSON.stringify({ exclude })
      );

      const result = await schematicRunner
        .runSchematicAsync(schematicName, {}, tree)
        .toPromise();

      const tsconfigJson = readJsonInTree(
        result,
        `libs/${lib}/tsconfig.lib.json`
      );
      expect(tsconfigJson.exclude).toEqual(exclude);
    });

    it('should modify untouched jest projects', async () => {
      const lib = 'jest-lib';
      const exclude = [`src/test.ts`, '**/*.spec.ts'];
      const expected = ['src/test-setup.ts', '**/*.spec.ts'];

      tree = await createLibWithTests(tree, lib, jestBuilder, 'test-setup.ts');
      tree.create(
        `/libs/${lib}/tsconfig.lib.json`,
        JSON.stringify({ exclude })
      );

      const result = await schematicRunner
        .runSchematicAsync(schematicName, {}, tree)
        .toPromise();

      const tsconfigJson = readJsonInTree(
        result,
        `libs/${lib}/tsconfig.lib.json`
      );

      expect(tsconfigJson.exclude).toEqual(expected);
    });

    it('should not touch modified jest projects', async () => {
      const lib = 'modified-jest-lib';
      const exclude = [`src/test-modified.ts`, '**/*.spec.ts'];

      tree = await createLibWithTests(
        tree,
        lib,
        jestBuilder,
        'test-modified.ts.ts'
      );
      tree.create(
        `/libs/${lib}/tsconfig.lib.json`,
        JSON.stringify({ exclude })
      );

      const result = await schematicRunner
        .runSchematicAsync(schematicName, {}, tree)
        .toPromise();

      const tsconfigJson = readJsonInTree(
        result,
        `libs/${lib}/tsconfig.lib.json`
      );
      expect(tsconfigJson.exclude).toEqual(exclude);
    });
  });
});
