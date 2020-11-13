import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readJsonInTree } from '@nrwl/workspace';
import * as path from 'path';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
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
  });

  it(`should update emotion, if used, to the new package names`, async () => {
    tree.overwrite(
      'package.json',
      JSON.stringify({
        dependencies: {
          '@emotion/core': '10.1.1',
        },
      })
    );

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
});
