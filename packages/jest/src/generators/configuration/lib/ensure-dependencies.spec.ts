import {
  detectPackageManager,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { ensureDependencies } from './ensure-dependencies';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  detectPackageManager: jest.fn(),
}));

describe('ensureDependencies', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    (detectPackageManager as jest.Mock).mockReturnValue('npm');
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
      // required peer of @swc/jest. Package managers that don't auto-install
      // peers (yarn) otherwise leave jest unable to load the transformer
      expect(packageJson.devDependencies['@swc/core']).toBeDefined();
    });

    it('should deny the @swc/core build scripts when using pnpm', () => {
      (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
      updateJson(tree, 'package.json', (json) => {
        json.packageManager = 'pnpm@11.2.2';
        return json;
      });

      ensureDependencies(tree, { compiler: 'swc' });

      expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toContain(
        'allowBuilds:\n  "@swc/core": false'
      );
    });

    it('should not write pnpm-workspace.yaml when not using the swc compiler', () => {
      (detectPackageManager as jest.Mock).mockReturnValue('pnpm');
      updateJson(tree, 'package.json', (json) => {
        json.packageManager = 'pnpm@11.2.2';
        return json;
      });

      ensureDependencies(tree, { compiler: 'tsc' });

      expect(tree.exists('pnpm-workspace.yaml')).toBe(false);
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
