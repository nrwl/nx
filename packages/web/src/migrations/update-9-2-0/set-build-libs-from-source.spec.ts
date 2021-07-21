import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readWorkspace, updateJsonInTree } from '@nrwl/workspace';

import * as path from 'path';

describe('set buildLibsFromSource to true', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/web',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should set buildLibsFromSource to true`, async () => {
    tree = await schematicRunner
      .callRule(
        updateJsonInTree('workspace.json', () => ({
          projects: {
            demo: {
              root: 'apps/demo',
              sourceRoot: 'apps/demo/src',
              architect: {
                build: {
                  builder: '@nrwl/web:build',
                  options: {},
                },
              },
            },
          },
        })),
        tree
      )
      .toPromise();

    tree = await schematicRunner
      .runSchematicAsync('set-build-libs-from-source', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    expect(config.projects.demo.architect.build.options).toEqual({
      buildLibsFromSource: true,
    });
  });
});
