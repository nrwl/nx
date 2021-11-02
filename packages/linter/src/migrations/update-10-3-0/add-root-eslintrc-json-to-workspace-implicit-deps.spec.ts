import { runMigration } from '../../utils/testing';
import { UnitTestTree } from '@angular-devkit/schematics/testing';
import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { serializeJson } from '@nrwl/devkit';

describe('Update implicitDependencies within nx.json to include root .eslintrc.json', () => {
  let tree: UnitTestTree;
  beforeEach(() => {
    tree = new UnitTestTree(Tree.empty());
    tree.create(
      'nx.json',
      serializeJson({
        npmScope: 'nrwl',
        implicitDependencies: {
          'workspace.json': '*',
          'package.json': {
            dependencies: '*',
            devDependencies: '*',
          },
          'tsconfig.base.json': '*',
          'tslint.json': '*',
          'nx.json': '*',
        },
        tasksRunnerOptions: {},
        workspaceLayout: {
          libsDir: 'packages',
        },
        affected: {
          defaultBase: 'main',
        },
      })
    );
  });

  it('should add the root .eslintrc.json file to the implicitDependencies in nx.json', async () => {
    const result = await runMigration(
      'add-root-eslintrc-json-to-workspace-implicit-deps',
      {},
      tree
    );
    expect(readJsonInTree(result, 'nx.json').implicitDependencies)
      .toMatchInlineSnapshot(`
      Object {
        ".eslintrc.json": "*",
        "nx.json": "*",
        "package.json": Object {
          "dependencies": "*",
          "devDependencies": "*",
        },
        "tsconfig.base.json": "*",
        "tslint.json": "*",
        "workspace.json": "*",
      }
    `);
  });
});
