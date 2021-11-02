import { Tree } from '@angular-devkit/schematics';
import {
  readJsonInTree,
  readWorkspace,
  updateJsonInTree,
  updateWorkspace,
} from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

describe('Add explicit .json file extension to .eslintrc files', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateJsonInTree('.eslintrc', () => ({})),
      tree
    );
    tree = await callRule(
      updateWorkspace((workspace) => {
        // Old linter builder with ESLint, with explicit config file reference
        // that needs to be updated
        workspace.projects.add({
          name: 'testProject',
          root: 'apps/testProject',
          sourceRoot: 'apps/testProject/src',
          projectType: 'application',
          targets: {
            lint: {
              builder: '@nrwl/linter:lint',
              options: {
                linter: 'eslint',
                config: '.eslintrc',
                tsConfig: [
                  'apps/testProject/tsconfig.app.json',
                  'apps/testProject/tsconfig.spec.json',
                ],
                exclude: ['**/node_modules/**', '!apps/testProject/**/*'],
              },
            },
          },
        });

        // New eslint builder, with explicit config file reference
        // that needs to be updated
        workspace.projects.add({
          name: 'testProject2',
          root: 'apps/testProject2',
          sourceRoot: 'apps/testProject2/src',
          projectType: 'application',
          targets: {
            lint: {
              builder: '@nrwl/linter:eslint',
              options: {
                eslintConfig: '.eslintrc',
                lintFilePatterns: ['apps/testProject2/**/*.ts'],
              },
            },
          },
        });
      }),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/testProject/.eslintrc', () => ({})),
      tree
    );
    tree = await callRule(
      updateJsonInTree('apps/testProject2/.eslintrc', () => ({})),
      tree
    );
  });

  it('should rename .eslintrc files to .eslintrc.json and update any workspace.json references', async () => {
    const result = await runMigration('add-json-ext-to-eslintrc', {}, tree);

    const workspace = readWorkspace(tree);

    // ---------------------------------------- Root
    expect(() =>
      readJsonInTree(result, '.eslintrc')
    ).toThrowErrorMatchingInlineSnapshot(`"Cannot find .eslintrc"`);
    expect(readJsonInTree(result, '.eslintrc.json')).toMatchInlineSnapshot(
      `Object {}`
    );

    // ---------------------------------------- testProject
    expect(() =>
      readJsonInTree(result, 'apps/testProject/.eslintrc')
    ).toThrowErrorMatchingInlineSnapshot(
      `"Cannot find apps/testProject/.eslintrc"`
    );
    expect(
      readJsonInTree(result, 'apps/testProject/.eslintrc.json')
    ).toMatchInlineSnapshot(`Object {}`);
    expect(
      workspace.projects['testProject'].architect.lint.options.config
    ).toEqual('.eslintrc.json');

    // ---------------------------------------- testProject2
    expect(() =>
      readJsonInTree(result, 'apps/testProject2/.eslintrc')
    ).toThrowErrorMatchingInlineSnapshot(
      `"Cannot find apps/testProject2/.eslintrc"`
    );
    expect(
      readJsonInTree(result, 'apps/testProject2/.eslintrc.json')
    ).toMatchInlineSnapshot(`Object {}`);
    expect(
      workspace.projects['testProject2'].architect.lint.options.eslintConfig
    ).toEqual('.eslintrc.json');
  });
});
