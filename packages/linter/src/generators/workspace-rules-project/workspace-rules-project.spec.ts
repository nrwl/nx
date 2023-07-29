import {
  addProjectConfiguration,
  NxJsonConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  lintWorkspaceRulesProjectGenerator,
  WORKSPACE_RULES_PROJECT_NAME,
} from './workspace-rules-project';

describe('@nx/linter:workspace-rules-project', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add lint project files to lint inputs', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.targetDefaults = {
        lint: {
          inputs: ['default', '{workspaceRoot}/.eslintrc.json'],
        },
      };
      return json;
    });
    await lintWorkspaceRulesProjectGenerator(tree);

    expect(
      readJson<NxJsonConfiguration>(tree, 'nx.json').targetDefaults.lint.inputs
    ).toContain('{workspaceRoot}/tools/eslint-rules/**/*');
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
      tree.read('tools/eslint-rules/jest.config.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should extend from root tsconfig.base.json', async () => {
    await lintWorkspaceRulesProjectGenerator(tree);

    const tsConfig = readJson(tree, 'tools/eslint-rules/tsconfig.json');
    expect(tsConfig.extends).toBe('../../tsconfig.base.json');
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await lintWorkspaceRulesProjectGenerator(tree);

    const tsConfig = readJson(tree, 'tools/eslint-rules/tsconfig.json');
    expect(tsConfig.extends).toBe('../../tsconfig.json');
  });

  it('should create a project with a test target', async () => {
    await lintWorkspaceRulesProjectGenerator(tree);

    expect(readProjectConfiguration(tree, WORKSPACE_RULES_PROJECT_NAME))
      .toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "eslint-rules",
        "root": "tools/eslint-rules",
        "sourceRoot": "tools/eslint-rules",
        "targets": {
          "test": {
            "configurations": {
              "ci": {
                "ci": true,
                "codeCoverage": true,
              },
            },
            "executor": "@nx/jest:jest",
            "options": {
              "jestConfig": "tools/eslint-rules/jest.config.ts",
              "passWithNoTests": true,
            },
            "outputs": [
              "{workspaceRoot}/coverage/{projectRoot}",
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
