import { Tree } from '@angular-devkit/schematics';
import { readWorkspace, updateWorkspace } from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('Revert any node_modules lintFilesPatterns that were accidentally included by update-eslint-builder-and-config', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'testProject',
          root: 'apps/testProject',
          sourceRoot: 'apps/testProject/src',
          projectType: 'application',
          targets: {
            lint: {
              builder: '@nrwl/linter:eslint',
              options: {
                lintFilePatterns: [
                  'apps/testProject/**/*.js',
                  'apps/testProject/**/*.jsx',
                  'apps/testProject/**/*.ts',
                  'apps/testProject/**/*.tsx',
                  'apps/testProject/some-random-relative-file.ts',
                  'apps/testProject/something-ad-hoc/**/*.ts',
                  'apps/testProject/**/*.spec.ts',
                  'apps/testProject/**/*.spec.tsx',
                  'apps/testProject/**/*.spec.js',
                  'apps/testProject/**/*.spec.jsx',
                  'apps/testProject/**/*.d.ts',
                  // These two should be removed by the migration
                  'node_modules/@nrwl/react/typings/cssmodule.d.ts',
                  'node_modules/@nrwl/react/typings/image.d.ts',
                ],
              },
            },
          },
        });
      }),
      tree
    );
  });

  it('should remove any patterns starting with node_modules from the lintFilePatterns array', async () => {
    await runMigration(
      'revert-node-modules-files-in-eslint-builder-options',
      {},
      tree
    );

    const workspace = readWorkspace(tree);

    expect(workspace.projects['testProject'].architect.lint)
      .toMatchInlineSnapshot(`
      Object {
        "builder": "@nrwl/linter:eslint",
        "options": Object {
          "lintFilePatterns": Array [
            "apps/testProject/**/*.js",
            "apps/testProject/**/*.jsx",
            "apps/testProject/**/*.ts",
            "apps/testProject/**/*.tsx",
            "apps/testProject/some-random-relative-file.ts",
            "apps/testProject/something-ad-hoc/**/*.ts",
            "apps/testProject/**/*.spec.ts",
            "apps/testProject/**/*.spec.tsx",
            "apps/testProject/**/*.spec.js",
            "apps/testProject/**/*.spec.jsx",
            "apps/testProject/**/*.d.ts",
          ],
        },
      }
    `);
  });
});
