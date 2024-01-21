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
