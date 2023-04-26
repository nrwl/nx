import { readJson, Tree } from '@nx/devkit';
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
});
