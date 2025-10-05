import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  Tree,
  addProjectConfiguration,
  readProjectConfiguration,
  readJson,
  getProjects,
  writeJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { e2eProjectGenerator } from './e2e';

describe('NxPlugin e2e-project Generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    // add a plugin project to the workspace for validations
    addProjectConfiguration(tree, 'my-plugin', {
      root: 'libs/my-plugin',
      targets: {},
    });
    writeJson(tree, 'libs/my-plugin/package.json', {
      name: 'my-plugin',
    });
  });

  it('should validate the plugin name', async () => {
    await expect(
      e2eProjectGenerator(tree, {
        pluginName: 'my-plugin',
        pluginOutputPath: `dist/libs/my-plugin`,
        npmPackageName: '@proj/my-plugin',
        addPlugin: true,
      })
    ).resolves.toBeDefined();

    await expect(
      e2eProjectGenerator(tree, {
        pluginName: 'my-nonexistentplugin',
        pluginOutputPath: `dist/libs/my-nonexistentplugin`,
        npmPackageName: '@proj/my-nonexistentplugin',
        addPlugin: true,
      })
    ).rejects.toThrow();
  });

  it('should add files related to e2e', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    expect(tree.exists('my-plugin-e2e/tsconfig.json')).toBeTruthy();
    expect(tree.exists('my-plugin-e2e/src/my-plugin.spec.ts')).toBeTruthy();
  });

  it('should extend from root tsconfig.base.json', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    const tsConfig = readJson(tree, 'my-plugin-e2e/tsconfig.json');
    expect(tsConfig.extends).toEqual('../tsconfig.base.json');
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    const tsConfig = readJson(tree, 'my-plugin-e2e/tsconfig.json');
    expect(tsConfig.extends).toEqual('../tsconfig.json');
  });

  it('should set project root with the directory option', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/namespace/my-plugin`,
      npmPackageName: '@proj/namespace-my-plugin',
      projectDirectory: 'namespace/my-plugin',
      addPlugin: true,
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');
    expect(project.root).toBe('namespace/my-plugin-e2e');
  });

  it('should update the implicit dependencies', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });
    const projects = Object.fromEntries(getProjects(tree));
    expect(projects).toMatchObject({
      'my-plugin-e2e': {
        implicitDependencies: ['my-plugin'],
      },
    });
  });

  it('should update the workspace', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');

    expect(project).toBeTruthy();
    expect(project.root).toEqual('my-plugin-e2e');
    expect(project.targets.e2e).toBeTruthy();
    expect(project.targets.e2e).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
        ],
        "executor": "@nx/jest:jest",
        "options": {
          "jestConfig": "my-plugin-e2e/jest.config.ts",
          "runInBand": true,
        },
        "outputs": [
          "{workspaceRoot}/coverage/{projectRoot}",
        ],
      }
    `);
  });

  it('should not update create e2e target if target covered by existing plugin', async () => {
    updateJson(tree, 'nx.json', (json) => {
      return {
        ...(json ?? {}),
        plugins: [
          ...(json.plugins ?? []),
          {
            plugin: '@nx/jest/plugin',
            include: ['e2e/**/*'],
            options: {
              targetName: 'e2e',
              ciTargetName: 'e2e-ci',
            },
          },
        ],
      };
    });

    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');

    expect(project).toBeTruthy();
    expect(project.root).toEqual('my-plugin-e2e');
    expect(project.targets.e2e).toBeFalsy();
  });

  it('should add jest support', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    const project = readProjectConfiguration(tree, 'my-plugin-e2e');

    expect(project.targets.e2e).toMatchObject({
      options: expect.objectContaining({
        jestConfig: 'my-plugin-e2e/jest.config.ts',
      }),
    });

    expect(tree.exists('my-plugin-e2e/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('my-plugin-e2e/jest.config.ts')).toBeTruthy();
    expect(tree.read('my-plugin-e2e/jest.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export default {
        displayName: 'my-plugin-e2e',
        preset: '../jest.preset.js',
        transform: {
          '^.+\\\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
        },
        moduleFileExtensions: ['ts', 'js', 'html'],
        coverageDirectory: '../coverage/my-plugin-e2e',
        globalSetup: '../tools/scripts/start-local-registry.ts',
        globalTeardown: '../tools/scripts/stop-local-registry.ts',
      };
      "
    `);
    expect(tree.exists('my-plugin-e2e/.spec.swcrc')).toBeFalsy();
  });

  it('should setup the eslint builder', async () => {
    await e2eProjectGenerator(tree, {
      pluginName: 'my-plugin',
      pluginOutputPath: `dist/libs/my-plugin`,
      npmPackageName: '@proj/my-plugin',
      addPlugin: true,
    });

    expect(
      tree.read('my-plugin-e2e/.eslintrc.json', 'utf-8')
    ).toMatchSnapshot();
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      // add a plugin project to the workspace for validations
      addProjectConfiguration(tree, 'my-plugin', {
        root: 'packages/my-plugin',
      });
      writeJson(tree, 'packages/my-plugin/package.json', {
        name: 'my-plugin',
      });
    });

    it('should add jest support', async () => {
      await e2eProjectGenerator(tree, {
        pluginName: 'my-plugin',
        npmPackageName: '@proj/my-plugin',
        projectDirectory: 'packages/my-plugin',
        pluginOutputPath: `dist/packages/my-plugin`,
      });

      const project = readProjectConfiguration(tree, 'my-plugin-e2e');

      expect(project.targets.e2e).toMatchObject({
        options: expect.objectContaining({
          jestConfig: 'packages/my-plugin-e2e/jest.config.ts',
        }),
      });

      expect(
        tree.exists('packages/my-plugin-e2e/tsconfig.spec.json')
      ).toBeTruthy();
      expect(tree.exists('packages/my-plugin-e2e/jest.config.ts')).toBeTruthy();
      expect(tree.read('packages/my-plugin-e2e/jest.config.ts', 'utf-8'))
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
          displayName: 'my-plugin-e2e',
          preset: '../../jest.preset.js',
          transform: {
            '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: 'test-output/jest/coverage',
          globalSetup: '../../tools/scripts/start-local-registry.ts',
          globalTeardown: '../../tools/scripts/stop-local-registry.ts',
        };
        "
      `);
      expect(tree.exists('packages/my-plugin-e2e/.spec.swcrc')).toBeTruthy();
      expect(tree.read('packages/my-plugin-e2e/.spec.swcrc', 'utf-8'))
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
