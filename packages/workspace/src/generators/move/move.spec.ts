import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { moveGenerator } from './move';
// nx-ignore-next-line
const { applicationGenerator } = require('@nx/react');

// nx-ignore-next-line
const { libraryGenerator } = require('@nx/js');

describe('move', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should update jest config when moving down directories', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
      projectNameAndRootFormat: 'as-provided',
    });

    const jestConfigPath = 'shared/my-lib-new/jest.config.ts';
    const afterJestConfig = tree.read(jestConfigPath, 'utf-8');
    expect(tree.exists(jestConfigPath)).toBeTruthy();
    expect(afterJestConfig).toContain("preset: '../../jest.preset.js'");
    expect(afterJestConfig).toContain(
      "coverageDirectory: '../../coverage/shared/my-lib-new'"
    );
  });

  it('should make sure build targets are correct when moving', async () => {
    await libraryGenerator(tree, {
      name: 'one',
      projectNameAndRootFormat: 'as-provided',
    });

    const myLibConfig = readProjectConfiguration(tree, 'one');

    updateProjectConfiguration(tree, 'one', {
      ...myLibConfig,
      targets: {
        ...myLibConfig.targets,
        custom: {
          executor: 'some-executor',
          options: {
            buildTarget: 'one:build:production',
            serveTarget: 'one:serve:production',
            irrelevantTarget: 'my-lib:build:production',
          },
        },
      },
    });

    await moveGenerator(tree, {
      projectName: 'one',
      importPath: '@proj/two',
      newProjectName: 'two',
      updateImportPath: true,
      destination: 'shared/two',
      projectNameAndRootFormat: 'as-provided',
    });

    const myLibNewConfig = readProjectConfiguration(tree, 'two');

    expect(myLibNewConfig.targets.custom.options.buildTarget).toEqual(
      'two:build:production'
    );
    expect(myLibNewConfig.targets.custom.options.serveTarget).toEqual(
      'two:serve:production'
    );
    expect(myLibNewConfig.targets.custom.options.irrelevantTarget).toEqual(
      'my-lib:build:production'
    );
  });

  it('should update jest config when moving up directories', async () => {
    await libraryGenerator(tree, {
      name: 'shared-my-lib',
      directory: 'shared/my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    await moveGenerator(tree, {
      projectName: 'shared-my-lib',
      importPath: '@proj/mylib',
      updateImportPath: true,
      destination: 'my-lib-new',
      projectNameAndRootFormat: 'as-provided',
    });

    const jestConfigPath = 'my-lib-new/jest.config.ts';
    const afterJestConfig = tree.read(jestConfigPath, 'utf-8');
    expect(tree.exists(jestConfigPath)).toBeTruthy();
    expect(afterJestConfig).toContain("preset: '../jest.preset.js'");
    expect(afterJestConfig).toContain(
      "coverageDirectory: '../coverage/my-lib-new'"
    );
  });

  it('should update $schema path when move', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    let projectJson = readJson(tree, 'my-lib/project.json');
    expect(projectJson['$schema']).toEqual(
      '../node_modules/nx/schemas/project-schema.json'
    );

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
      projectNameAndRootFormat: 'as-provided',
    });

    projectJson = readJson(tree, 'shared/my-lib-new/project.json');
    expect(projectJson['$schema']).toEqual(
      '../../node_modules/nx/schemas/project-schema.json'
    );
  });

  it('should support moving root projects', async () => {
    // Test that these are not moved
    tree.write('.gitignore', '');
    tree.write('README.md', '');

    await libraryGenerator(tree, {
      name: 'my-lib',
      rootProject: true,
      bundler: 'tsc',
      buildable: true,
      unitTestRunner: 'jest',
      linter: 'eslint',
      projectNameAndRootFormat: 'as-provided',
    });

    updateJson(tree, 'tsconfig.json', (json) => {
      json.extends = './tsconfig.base.json';
      json.files = ['./node_modules/@foo/bar/index.d.ts'];
      return json;
    });

    let projectJson = readJson(tree, 'project.json');
    expect(projectJson['$schema']).toEqual(
      'node_modules/nx/schemas/project-schema.json'
    );
    // Test that this does not get moved
    tree.write('other-lib/index.ts', '');

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/my-lib',
      updateImportPath: true,
      destination: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(readJson(tree, 'my-lib/project.json')).toMatchObject({
      name: 'my-lib',
      $schema: '../node_modules/nx/schemas/project-schema.json',
      sourceRoot: 'my-lib/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          outputs: ['{options.outputPath}'],
          options: {
            outputPath: 'dist/my-lib',
            main: 'my-lib/src/index.ts',
            tsConfig: 'my-lib/tsconfig.lib.json',
          },
        },
        lint: {
          executor: '@nx/eslint:lint',
        },
        test: {
          executor: '@nx/jest:jest',
          outputs: ['{workspaceRoot}/coverage/{projectName}'],
        },
      },
    });

    expect(readJson(tree, 'my-lib/tsconfig.json')).toMatchObject({
      extends: '../tsconfig.base.json',
      files: ['../node_modules/@foo/bar/index.d.ts'],
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ],
    });

    const jestConfig = tree.read('my-lib/jest.config.lib.ts', 'utf-8');
    expect(jestConfig).toContain(`preset: '../jest.preset.js'`);

    expect(tree.exists('my-lib/tsconfig.lib.json')).toBeTruthy();
    expect(tree.exists('my-lib/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('my-lib/.eslintrc.json')).toBeTruthy();
    expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();

    // Test that other libs and workspace files are not moved.
    expect(tree.exists('package.json')).toBeTruthy();
    expect(tree.exists('README.md')).toBeTruthy();
    expect(tree.exists('.gitignore')).toBeTruthy();
    expect(tree.exists('other-lib/index.ts')).toBeTruthy();

    // Test that root configs are extracted
    expect(tree.exists('tsconfig.base.json')).toBeTruthy();
    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).not.toBeTruthy();
    expect(tree.exists('.eslintrc.json')).toBeTruthy();

    // Test that eslint migration was done
    expect(readJson(tree, 'my-lib/.eslintrc.json').extends)
      .toMatchInlineSnapshot(`
      [
        "../.eslintrc.json",
      ]
    `);
    expect(readJson(tree, 'my-lib/.eslintrc.json').plugins).not.toBeDefined();
    expect(readJson(tree, '.eslintrc.json').plugins).toEqual(['@nx']);
  });

  it('should support moving standalone repos', async () => {
    // Test that these are not moved
    tree.write('.gitignore', '');
    tree.write('README.md', '');

    await applicationGenerator(tree, {
      name: 'react-app',
      rootProject: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'cypress',
      linter: 'eslint',
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });
    expect(readJson(tree, '.eslintrc.json').plugins).toEqual(['@nx']);
    expect(readJson(tree, 'e2e/.eslintrc.json').plugins).toEqual(['@nx']);

    // Test that this does not get moved
    tree.write('other-lib/index.ts', '');

    await moveGenerator(tree, {
      projectName: 'react-app',
      updateImportPath: false,
      destination: 'apps/react-app',
      projectNameAndRootFormat: 'as-provided',
    });

    // expect both eslint configs to have been changed
    expect(tree.exists('.eslintrc.json')).toBeDefined();
    expect(
      readJson(tree, 'apps/react-app/.eslintrc.json').plugins
    ).toBeUndefined();
    expect(readJson(tree, 'e2e/.eslintrc.json').plugins).toBeUndefined();

    await moveGenerator(tree, {
      projectName: 'e2e',
      updateImportPath: false,
      destination: 'apps/react-app-e2e',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.read('apps/react-app-e2e/cypress.config.ts').toString())
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

      import { defineConfig } from 'cypress';

      export default defineConfig({
        e2e: {
          ...nxE2EPreset(__filename, { cypressDir: 'src' }),
          baseUrl: 'http://localhost:4200',
        },
      });
      "
    `);
  });

  it('should correctly move standalone repos that have migrated eslint config', async () => {
    // Test that these are not moved
    tree.write('.gitignore', '');
    tree.write('README.md', '');

    await applicationGenerator(tree, {
      name: 'react-app',
      rootProject: true,
      unitTestRunner: 'jest',
      e2eTestRunner: 'cypress',
      linter: 'eslint',
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });
    await libraryGenerator(tree, {
      name: 'my-lib',
      bundler: 'tsc',
      buildable: true,
      unitTestRunner: 'jest',
      linter: 'eslint',
      directory: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });
    // assess the correct starting position
    expect(tree.exists('.eslintrc.base.json')).toBeTruthy();
    expect(readJson(tree, '.eslintrc.json').plugins).not.toBeDefined();
    expect(readJson(tree, '.eslintrc.json').extends).toEqual([
      'plugin:@nx/react',
      './.eslintrc.base.json',
    ]);
    expect(readJson(tree, 'e2e/.eslintrc.json').plugins).not.toBeDefined();
    expect(readJson(tree, 'e2e/.eslintrc.json').extends).toEqual([
      'plugin:cypress/recommended',
      '../.eslintrc.base.json',
    ]);

    await moveGenerator(tree, {
      projectName: 'react-app',
      updateImportPath: false,
      destination: 'apps/react-app',
      projectNameAndRootFormat: 'as-provided',
    });

    // expect both eslint configs to have been changed
    expect(tree.exists('.eslintrc.json')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).toBeFalsy();

    expect(readJson(tree, 'apps/react-app/.eslintrc.json').extends).toEqual([
      'plugin:@nx/react',
      '../../.eslintrc.json',
    ]);
    expect(readJson(tree, 'e2e/.eslintrc.json').extends).toEqual([
      'plugin:cypress/recommended',
      '../.eslintrc.json',
    ]);
  });

  it('should support scoped new project name for libraries', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    await moveGenerator(tree, {
      projectName: 'my-lib',
      newProjectName: '@proj/shared-my-lib',
      updateImportPath: true,
      destination: 'shared/my-lib',
      projectNameAndRootFormat: 'as-provided',
    });

    expect(tree.exists('shared/my-lib/package.json')).toBeTruthy();
    expect(tree.exists('shared/my-lib/tsconfig.lib.json')).toBeTruthy();
    expect(tree.exists('shared/my-lib/src/index.ts')).toBeTruthy();
    expect(readProjectConfiguration(tree, '@proj/shared-my-lib'))
      .toMatchInlineSnapshot(`
      {
        "$schema": "../../node_modules/nx/schemas/project-schema.json",
        "name": "@proj/shared-my-lib",
        "projectType": "library",
        "root": "shared/my-lib",
        "sourceRoot": "shared/my-lib/src",
        "tags": [],
        "targets": {
          "build": {
            "executor": "@nx/js:tsc",
            "options": {
              "assets": [
                "shared/my-lib/*.md",
              ],
              "main": "shared/my-lib/src/index.ts",
              "outputPath": "dist/shared/my-lib",
              "tsConfig": "shared/my-lib/tsconfig.lib.json",
            },
            "outputs": [
              "{options.outputPath}",
            ],
          },
          "lint": {
            "executor": "@nx/eslint:lint",
            "outputs": [
              "{options.outputFile}",
            ],
          },
          "test": {
            "executor": "@nx/jest:jest",
            "options": {
              "jestConfig": "shared/my-lib/jest.config.ts",
            },
            "outputs": [
              "{workspaceRoot}/coverage/{projectRoot}",
            ],
          },
        },
      }
    `);
  });

  it('should move project correctly when --project-name-and-root-format=derived', async () => {
    await libraryGenerator(tree, {
      name: 'my-lib',
      projectNameAndRootFormat: 'derived',
    });

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
      projectNameAndRootFormat: 'derived',
    });

    const projectJson = readJson(tree, 'libs/shared/my-lib-new/project.json');
    expect(projectJson['$schema']).toEqual(
      '../../../node_modules/nx/schemas/project-schema.json'
    );
    const afterJestConfig = tree.read(
      'libs/shared/my-lib-new/jest.config.ts',
      'utf-8'
    );
    expect(afterJestConfig).toContain("preset: '../../../jest.preset.js'");
    expect(afterJestConfig).toContain(
      "coverageDirectory: '../../../coverage/libs/shared/my-lib-new'"
    );
  });
});
