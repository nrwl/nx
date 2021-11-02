import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace, runSchematic } from '@nrwl/workspace/testing';
import { emotionReactVersion } from '../../utils/versions';

describe('Rename Emotion Packages 11.0.0', () => {
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
          '@emotion/core': '10.1.1',
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
      dependencies: {
        '@emotion/react': emotionReactVersion,
      },
    });
  });

  it(`should update emotion, if used, to the new package names where imported`, async () => {
    tree = await runSchematic('lib', { name: 'library-1' }, tree);

    const moduleThatImports = 'libs/library-1/src/importer.ts';
    tree.create(
      moduleThatImports,
      `import emotion from '@emotion/core';

      export const doSomething = (...args) => something(...args);
      `
    );

    tree = await schematicRunner
      .runSchematicAsync('rename-emotion-packages-11.0.0', {}, tree)
      .toPromise();

    expect(tree.read(moduleThatImports).toString()).toContain(
      `import emotion from '@emotion/react'`
    );
  });
});
