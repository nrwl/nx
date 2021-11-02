import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace, runSchematic } from '@nrwl/workspace/testing';
import { emotionServerVersion } from '../../utils/versions';

describe('Rename Emotion Packages 11.0.0', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    schematicRunner = new SchematicTestRunner(
      '@nrwl/next',
      path.join(__dirname, '../../../migrations.json')
    );
    tree.overwrite(
      'package.json',
      JSON.stringify({
        devDependencies: {
          'emotion-server': '10.0.27',
        },
      })
    );
  });

  it(`should update emotion, if used, to the new package names`, async () => {
    tree = await schematicRunner
      .runSchematicAsync('rename-emotion-packages-11.0.0', {}, tree)
      .toPromise();

    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson).toMatchObject({
      devDependencies: {
        '@emotion/server': emotionServerVersion,
      },
    });
  });

  it(`should update emotion, if used, to the new package names where imported`, async () => {
    tree = await runSchematic('lib', { name: 'library-1' }, tree);

    const moduleThatImports = 'libs/library-1/src/importer.ts';
    tree.create(
      moduleThatImports,
      `import serve from 'emotion-server';

      export const doSomething = (...args) => serve(...args);
      `
    );

    tree = await schematicRunner
      .runSchematicAsync('rename-emotion-packages-11.0.0', {}, tree)
      .toPromise();

    expect(tree.read(moduleThatImports).toString()).toContain(
      `import serve from '@emotion/server'`
    );
  });
});
