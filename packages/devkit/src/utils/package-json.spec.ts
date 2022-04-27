import type { Tree } from 'nx/src/generators/tree';
import { readJson, writeJson } from './json';
import { addDependenciesToPackageJson } from './package-json';
import { createTree } from '../tests/create-tree';

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

  it('should not overwrite existing dependencies in the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {
        react: 'next',
      },
      {}
    );
    expect(readJson(tree, 'package.json').dependencies).toEqual({
      react: 'latest',
    });
    expect(installTask).toBeDefined();
  });

  it('should add devDependencies to the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        '@nrwl/react': 'latest',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'latest',
      '@nrwl/react': 'latest',
    });
    expect(installTask).toBeDefined();
  });

  it('should not overwrite existing devDependencies in the package.json', () => {
    const installTask = addDependenciesToPackageJson(
      tree,
      {},
      {
        jest: 'next',
      }
    );
    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: 'latest',
    });
    expect(installTask).toBeDefined();
  });
});
