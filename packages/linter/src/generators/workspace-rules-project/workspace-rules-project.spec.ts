import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  lintWorkspaceRulesProjectGenerator,
  WORKSPACE_RULES_PROJECT_NAME,
} from './workspace-rules-project';

describe('@nrwl/linter:workspace-rules-project', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update implicitDependencies in nx.json', async () => {
    expect(
      readJson(tree, 'nx.json').implicitDependencies
    ).toMatchInlineSnapshot(`undefined`);

    await lintWorkspaceRulesProjectGenerator(tree);

    expect(readJson(tree, 'nx.json').implicitDependencies)
      .toMatchInlineSnapshot(`
      Object {
        "tools/eslint-rules/**/*": "*",
      }
    `);
  });

  it('should generate the required files', async () => {
    await lintWorkspaceRulesProjectGenerator(tree);

    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/tsconfig.json', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/tsconfig.lint.json', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/tsconfig.spec.json', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.read('tools/eslint-rules/jest.config.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should create a project with a test target', async () => {
    await lintWorkspaceRulesProjectGenerator(tree);

    expect(readProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME))
      .toMatchInlineSnapshot(`
      Object {
        "root": "tools/eslint-rules",
        "sourceRoot": "tools/eslint-rules",
        "targets": Object {
          "test": Object {
            "executor": "@nrwl/jest:jest",
            "options": Object {
              "jestConfig": "tools/eslint-rules/jest.config.js",
              "passWithNoTests": true,
            },
            "outputs": Array [
              "coverage/tools/eslint-rules",
            ],
          },
        },
      }
    `);
  });

  it('should not update the required files if the project already exists', async () => {
    addProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME, {
      root: '',
    });

    const customIndexContents = `custom index contents`;
    tree.write('tools/eslint-rules/index.ts', customIndexContents);

    const customTsconfigContents = `custom tsconfig contents`;
    tree.write('tools/eslint-rules/tsconfig.json', customTsconfigContents);
    tree.write('tools/eslint-rules/tsconfig.lint.json', customTsconfigContents);
    tree.write('tools/eslint-rules/tsconfig.spec.json', customTsconfigContents);

    await lintWorkspaceRulesProjectGenerator(tree);

    expect(tree.read('tools/eslint-rules/index.ts', 'utf-8')).toEqual(
      customIndexContents
    );
    expect(tree.read('tools/eslint-rules/tsconfig.json', 'utf-8')).toEqual(
      customTsconfigContents
    );
    expect(tree.read('tools/eslint-rules/tsconfig.lint.json', 'utf-8')).toEqual(
      customTsconfigContents
    );
    expect(tree.read('tools/eslint-rules/tsconfig.spec.json', 'utf-8')).toEqual(
      customTsconfigContents
    );
  });
});
