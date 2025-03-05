import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
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
      directory: 'my-lib',
    });

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
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
      directory: 'one',
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
    });

    // check that the project.json file is present
    expect(tree.exists('shared/two/project.json')).toBeTruthy();
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
    // check that the package.json does not have nx config
    expect(readJson(tree, 'shared/two/package.json').nx).toBeUndefined();
  });

  it('should update jest config when moving up directories', async () => {
    await libraryGenerator(tree, {
      name: 'shared-my-lib',
      directory: 'shared/my-lib',
    });

    await moveGenerator(tree, {
      projectName: 'shared-my-lib',
      importPath: '@proj/mylib',
      updateImportPath: true,
      destination: 'my-lib-new',
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
      directory: 'my-lib',
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
    });

    projectJson = readJson(tree, 'shared/my-lib-new/project.json');
    expect(projectJson['$schema']).toEqual(
      '../../node_modules/nx/schemas/project-schema.json'
    );
  });

  it('should work without tsconfig.base.json (https://github.com/nrwl/nx/issues/28349)', async () => {
    await libraryGenerator(tree, {
      directory: 'my-lib',
    });
    tree.delete('tsconfig.base.json');

    await moveGenerator(tree, {
      projectName: 'my-lib',
      importPath: '@proj/shared-mylib',
      updateImportPath: true,
      destination: 'shared/my-lib-new',
    });

    expect(tree.exists('tsconfig.base.json')).toBeFalsy();
  });

  it('should correctly update the nx configuration when it is located in the package.json file', async () => {
    await libraryGenerator(tree, {
      directory: 'libs/lib1',
      useProjectJson: false,
      skipFormat: true,
    });
    updateProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      targets: {
        foo: {
          command: 'echo "foo"',
          options: {
            cwd: 'libs/lib1',
          },
        },
      },
    });

    await moveGenerator(tree, {
      projectName: 'lib1',
      destination: 'packages/lib1',
      updateImportPath: true,
      skipFormat: true,
    });

    // check that the nx config in the package.json is correct
    const packageJson = readJson(tree, 'packages/lib1/package.json');
    expect(packageJson.nx).toMatchInlineSnapshot(`
      {
        "name": "lib1",
        "projectType": "library",
        "sourceRoot": "packages/lib1/src",
        "targets": {
          "foo": {
            "command": "echo "foo"",
            "options": {
              "cwd": "packages/lib1",
            },
          },
        },
      }
    `);
    // check that we read the project configuration with the updated paths from the package.json
    const myLibNewConfig = readProjectConfiguration(tree, 'lib1');
    expect(myLibNewConfig.sourceRoot).toEqual('packages/lib1/src');
    expect(myLibNewConfig.targets.foo.options.cwd).toEqual('packages/lib1');
    // check that the project.json file is not present
    expect(tree.exists('packages/lib1/project.json')).toBeFalsy();
  });
});
