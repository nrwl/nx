import {
  addProjectConfiguration,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-deprecated-build-options';

describe('remove-deprecated-build-options', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove updateBuildableProjectDepsInPackageJson and buildableProjectDepsInPackageJsonType options from @nx/* executors', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: '@nx/js:tsc',
          options: {
            main: 'proj/main.ts',
            tsConfig: 'proj/tsconfig.json',
            outputPath: 'dist/proj',
            updateBuildableProjectDepsInPackageJson: true,
            buildableProjectDepsInPackageJsonType: 'peerDependencies',
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'proj');
    expect(updatedConfig.targets).toEqual({
      build: {
        executor: '@nx/js:tsc',
        options: {
          main: 'proj/main.ts',
          tsConfig: 'proj/tsconfig.json',
          outputPath: 'dist/proj',
        },
      },
    });
  });

  it('should work if targets are undefined', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should work if a target is an empty object', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {},
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should not update community executors', async () => {
    addProjectConfiguration(tree, 'proj', {
      root: 'proj',
      targets: {
        build: {
          executor: '@acme/js:tsc',
          options: {
            main: 'proj/main.ts',
            tsConfig: 'proj/tsconfig.json',
            outputPath: 'dist/proj',
            updateBuildableProjectDepsInPackageJson: true,
            buildableProjectDepsInPackageJsonType: 'peerDependencies',
          },
        },
      },
    });

    await migration(tree);

    const updatedConfig = readProjectConfiguration(tree, 'proj');
    expect(updatedConfig.targets).toEqual({
      build: {
        executor: '@acme/js:tsc',
        options: {
          main: 'proj/main.ts',
          tsConfig: 'proj/tsconfig.json',
          outputPath: 'dist/proj',
          updateBuildableProjectDepsInPackageJson: true,
          buildableProjectDepsInPackageJsonType: 'peerDependencies',
        },
      },
    });
  });
});
