import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';

describe('ensureDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('Deprecated: --babelJest', () => {
    it('should add babel dependencies', () => {
      ensureDependencies(tree, { babelJest: true });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['babel-jest']).toBeDefined();
    });
  });

  describe('--compiler', () => {
    it('should support tsc compiler', () => {
      ensureDependencies(tree, { compiler: 'tsc' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    });

    it('should support babel compiler', () => {
      ensureDependencies(tree, { compiler: 'babel' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['babel-jest']).toBeDefined();
    });

    it('should support swc compiler', () => {
      ensureDependencies(tree, { compiler: 'swc' });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['@swc/jest']).toBeDefined();
    });
  });

  it('should add dependencies --testEnvironment=node', () => {
    ensureDependencies(tree, { testEnvironment: 'node' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-node']).toBeDefined();
    expect(packageJson.devDependencies['jest-environment-node']).toBeDefined();
    expect(
      packageJson.devDependencies['jest-environment-jsdom']
    ).not.toBeDefined();
  });

  it('should add dependencies --testEnvironment=none', () => {
    ensureDependencies(tree, { testEnvironment: 'none' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@types/jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-jest']).toBeDefined();
    expect(packageJson.devDependencies['ts-node']).toBeDefined();
    expect(
      packageJson.devDependencies['jest-environment-jsdom']
    ).not.toBeDefined();
    expect(
      packageJson.devDependencies['jest-environment-node']
    ).not.toBeDefined();
  });
});
