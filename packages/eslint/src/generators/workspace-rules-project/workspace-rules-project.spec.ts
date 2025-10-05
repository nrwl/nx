import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  NxJsonConfiguration,
  readJson,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  lintWorkspaceRulesProjectGenerator,
  WORKSPACE_RULES_PROJECT_NAME,
} from './workspace-rules-project';

describe('@nx/eslint:workspace-rules-project', () => {
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

  it('should create the jest config using ts-jest', async () => {
    await lintWorkspaceRulesProjectGenerator(tree);

    expect(tree.exists('tools/eslint-rules/jest.config.ts')).toBeTruthy();
    expect(tree.read('tools/eslint-rules/jest.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export default {
        displayName: 'eslint-rules',
        preset: '../../jest.preset.js',
        testEnvironment: 'node',
        transform: {
          '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
        },
        moduleFileExtensions: ['ts', 'js', 'html'],
        coverageDirectory: '../../coverage/tools/eslint-rules',
      };
      "
    `);
    expect(tree.exists('tools/eslint-rules/.spec.swcrc')).toBeFalsy();
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

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: { composite: true },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should create the jest config using @swc/jest', async () => {
      await lintWorkspaceRulesProjectGenerator(tree);

      expect(tree.exists('tools/eslint-rules/jest.config.ts')).toBeTruthy();
      expect(tree.read('tools/eslint-rules/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          displayName: 'eslint-rules',
          preset: '../../jest.preset.js',
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: 'test-output/jest/coverage',
        };
        "
      `);
      expect(tree.exists('tools/eslint-rules/.spec.swcrc')).toBeTruthy();
      expect(tree.read('tools/eslint-rules/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "jsc": {
            "target": "es2017",
            "parser": {
              "syntax": "typescript",
              "decorators": true,
              "dynamicImport": true
            },
            "transform": {
              "decoratorMetadata": true,
              "legacyDecorator": true
            },
            "keepClassNames": true,
            "externalHelpers": true,
            "loose": true
          },
          "module": {
            "type": "es6"
          },
          "sourceMaps": true,
          "exclude": []
        }
        "
      `);
    });
  });
});
