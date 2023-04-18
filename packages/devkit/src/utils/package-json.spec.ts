import type { Tree } from 'nx/src/generators/tree';
import { readJson, writeJson } from 'nx/src/generators/utils/json';
import { addDependenciesToPackageJson, ensurePackage } from './package-json';
import { createTree } from 'nx/src/generators/testing-utils/create-tree';

describe('addDependenciesToPackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    writeJson(tree, 'package.json', {
      dependencies: {
        react: 'latest',
      },
      devDependencies: {
        jest: 'latest',
      },
    });
  });

  it('should not add dependency if it is not greater', () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        tslib: '^2.0.0',
      },
      devDependencies: {
        jest: '28.1.3',
      },
    });
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        tslib: '^2.3.0',
      },
      { jest: '28.1.1' }
    );

    expect(readJson(tree, 'package.json')).toEqual({
      dependencies: { tslib: '^2.3.0' },
      devDependencies: { jest: '28.1.3' },
    });
    expect(installTask).toBeDefined();
  });

  it('should add dependencies to the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        'react-dom': 'latest',
      },
      {}
    );
    expect(readJson(tree, 'package.json').dependencies).toEqual({
      react: 'latest',
      'react-dom': 'latest',
    });

    expect(installTask).toBeDefined();
  });

  it('should overwrite existing dependencies in the package.json if the version tag is greater', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        react: 'next',
      },
      {}
    );
    expect(readJson(tree, 'package.json').dependencies).toEqual({
      react: 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should add devDependencies to the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nx/react': 'latest',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'latest',
      '@nx/react': 'latest',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite existing devDependencies in the package.json if the version tag is greater', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        jest: 'next',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when they exist in devDependencies or vice versa and the version tag is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'latest',
      },
      devDependencies: {
        '@nx/next': 'latest',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'next',
      },
      {
        '@nx/angular': 'next',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the version tag is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'next',
      },
      devDependencies: {
        '@nx/next': 'next',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'latest',
      },
      {
        '@nx/angular': 'latest',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when they exist in devDependencies or vice versa and the version is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
      },
      devDependencies: {
        '@nx/next': '14.0.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.1.0',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the version is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.1.0',
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.0.0',
      },
      {
        '@nx/angular': '14.0.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in "dependencies" and one of the versions is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.2.0',
        '@nx/cypress': '14.1.1',
      },
      devDependencies: {
        '@nx/next': '14.0.0',
        '@nx/vite': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/angular': '14.1.0',
      },
      {
        '@nx/next': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.2.0',
      '@nx/cypress': '14.1.1',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
      '@nx/vite': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in "devDependencies" and one of the versions is lesser', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
        '@nx/cypress': '14.1.1',
      },
      devDependencies: {
        '@nx/next': '14.2.0',
        '@nx/vite': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/angular': '14.1.0',
      },
      {
        '@nx/next': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
      '@nx/cypress': '14.1.1',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.2.0',
      '@nx/vite': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should only overwrite dependencies when their version is greater', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': '14.0.0',
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': '14.0.0',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': '14.1.0',
    });
    expect(installTask).toBeDefined();
  });

  it('should overwrite dependencies when their version is not in a semver format', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'github:reponame/packageNameOne',
        '@nx/vite': 'git://github.com/npm/cli.git#v14.2.0', // this format is parsable
      },
      devDependencies: {
        '@nx/next': '14.1.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'github:reponame/packageNameTwo',
        '@nx/cypress':
          'git+https://username@github.com/reponame/packagename.git',
        '@nx/vite': '14.0.1',
      },
      {
        '@nx/angular': '14.1.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': '14.1.0',
      '@nx/cypress': 'git+https://username@github.com/reponame/packagename.git',
      '@nx/vite': 'git://github.com/npm/cli.git#v14.2.0',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'github:reponame/packageNameTwo',
    });
    expect(installTask).toBeDefined();
  });

  it('should add additional dependencies when they dont exist in devDependencies or vice versa and not update the ones that do exist', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        '@nx/angular': 'latest',
      },
      devDependencies: {
        '@nx/next': 'latest',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        '@nx/next': 'next',
        '@nx/cypress': 'latest',
      },
      {
        '@nx/angular': 'next',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@nx/angular': 'next',
      '@nx/cypress': 'latest',
    });
    expect(devDependencies).toEqual({
      '@nx/next': 'next',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite dependencies when they exist in devDependencies or vice versa and the new version is tilde', () => {
    // ARRANGE
    writeJson(tree, 'package.json', {
      dependencies: {
        tslib: '2.4.0',
      },
      devDependencies: {
        nx: '15.0.0',
      },
    });

    // ACT
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        tslib: '~2.3.0',
      },
      {
        nx: '15.0.0',
      }
    );

    // ASSERT
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      tslib: '2.4.0',
    });
    expect(devDependencies).toEqual({
      nx: '15.0.0',
    });
    expect(installTask).toBeDefined();
  });
});

describe('ensurePackage', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should return package when present', async () => {
    writeJson(tree, 'package.json', {});

    expect(ensurePackage('@nx/devkit', '>=15.0.0')).toEqual(
      require('@nx/devkit')
    ); // return void
  });
});
