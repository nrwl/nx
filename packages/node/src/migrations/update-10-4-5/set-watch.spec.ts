import { Tree } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { readWorkspace } from '@nrwl/workspace';

import * as path from 'path';

describe('set watch to true', () => {
  let tree: Tree;
  let schematicRunner: SchematicTestRunner;

  beforeEach(async () => {
    tree = Tree.empty();
    schematicRunner = new SchematicTestRunner(
      '@nrwl/node',
      path.join(__dirname, '../../../migrations.json')
    );
  });

  it(`should set watch to true`, async () => {
    tree.create(
      'workspace.json',
      JSON.stringify({
        projects: {
          demo: {
            root: 'apps/demo',
            sourceRoot: 'apps/demo/src',
            architect: {
              build: {
                builder: '@nrwl/node:execute',
                options: {},
              },
            },
          },
        },
      })
    );

    tree = await schematicRunner
      .runSchematicAsync('set-watch', {}, tree)
      .toPromise();

    const config = readWorkspace(tree);
    expect(config.projects.demo.architect.build.options).toEqual({
      watch: true,
    });
  });
});
