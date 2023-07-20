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
    await libraryGenerator(tree, { name: 'my-lib' });

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
    });
    const jestConfigPath = 'libs/shared/my-lib-new/jest.config.ts';
    const afterJestConfig = tree.read(jestConfigPath, 'utf-8');
    expect(tree.exists(jestConfigPath)).toBeTruthy();
    expect(afterJestConfig).toContain("preset: '../../../jest.preset.js'");
    expect(afterJestConfig).toContain(
      "coverageDirectory: '../../../coverage/libs/shared/my-lib-new'"
    );
  });

  it('should update jest config when moving up directories', async () => {
    await libraryGenerator(tree, { name: 'shared/my-lib' });

    await moveGenerator(tree, {
      projectName: 'shared-my-lib',
      importPath: '@proj/mylib',
      updateImportPath: true,
      destination: 'my-lib-new',
    });
    const jestConfigPath = 'libs/my-lib-new/jest.config.ts';
    const afterJestConfig = tree.read(jestConfigPath, 'utf-8');
    expect(tree.exists(jestConfigPath)).toBeTruthy();
    expect(afterJestConfig).toContain("preset: '../../jest.preset.js'");
    expect(afterJestConfig).toContain(
      "coverageDirectory: '../../coverage/libs/my-lib-new'"
    );
  });

  it('should update $schema path when move', async () => {
    await libraryGenerator(tree, { name: 'my-lib' });

    let projectJson = readJson(tree, 'libs/my-lib/project.json');
    expect(projectJson['$schema']).toEqual(
      '../../node_modules/nx/schemas/project-schema.json'
    );

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
    });

    projectJson = readJson(tree, 'libs/shared/my-lib-new/project.json');
    expect(projectJson['$schema']).toEqual(
      '../../../node_modules/nx/schemas/project-schema.json'
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
      unitTestRunner: 'vitest',
      linter: 'eslint',
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
    const projectGraph = {
      nodes: {
        'my-lib': {
          name: 'my-lib',
          type: 'lib' as const,
          data: {
            root: '.',
          },
        },
        'other-lib': {
          name: 'other-lib',
          type: 'lib' as const,
          data: {
            root: 'other-lib',
          },
        },
      },
      externalNodes: {},
      dependencies: {},
    };

    await moveGenerator(
      tree,
      {
        projectName: 'my-lib',
        importPath: '@proj/my-lib',
        updateImportPath: true,
        destination: 'my-lib',
      },
      projectGraph
    );

    expect(readJson(tree, 'libs/my-lib/project.json')).toMatchObject({
      name: 'my-lib',
      $schema: '../../node_modules/nx/schemas/project-schema.json',
      sourceRoot: 'libs/my-lib/src',
      projectType: 'library',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          outputs: ['{options.outputPath}'],
          options: {
            outputPath: 'dist/my-lib',
            main: 'libs/my-lib/src/index.ts',
            tsConfig: 'libs/my-lib/tsconfig.lib.json',
          },
        },
        lint: {
          executor: '@nx/linter:eslint',
          outputs: ['{options.outputFile}'],
          options: {
            lintFilePatterns: ['libs/my-lib/**/*.ts'],
          },
        },
        test: {
          executor: '@nx/vite:test',
          outputs: ['coverage/my-lib'],
        },
      },
    });

    expect(readJson(tree, 'libs/my-lib/tsconfig.json')).toMatchObject({
      extends: '../../tsconfig.base.json',
      files: ['../../node_modules/@foo/bar/index.d.ts'],
      references: [
        { path: './tsconfig.lib.json' },
        { path: './tsconfig.spec.json' },
      ],
    });

    const viteConfig = tree.read('libs/my-lib/vite.config.ts', 'utf-8');
    expect(viteConfig).toContain('../../node_modules/.vitest');
    expect(viteConfig).toContain('../../node_modules/.vite/my-lib');

    expect(tree.exists('libs/my-lib/tsconfig.lib.json')).toBeTruthy();
    expect(tree.exists('libs/my-lib/tsconfig.spec.json')).toBeTruthy();
    expect(tree.exists('libs/my-lib/.eslintrc.json')).toBeTruthy();
    expect(tree.exists('libs/my-lib/src/index.ts')).toBeTruthy();

    // Test that other libs and workspace files are not moved.
    expect(tree.exists('package.json')).toBeTruthy();
    expect(tree.exists('README.md')).toBeTruthy();
    expect(tree.exists('.gitignore')).toBeTruthy();
    expect(tree.exists('other-lib/index.ts')).toBeTruthy();
  });
});
