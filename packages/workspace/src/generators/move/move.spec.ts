import { readJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { moveGenerator } from './move';

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
          executor: '@nx/linter:eslint',
          outputs: ['{options.outputFile}'],
          options: {
            lintFilePatterns: ['my-lib/**/*.ts', 'my-lib/package.json'],
          },
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
    expect(tree.exists('.eslintrc.base.json')).toBeTruthy();
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
