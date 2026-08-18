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

  it('should support swc', () => {
    ensureDependencies(tree, { compiler: 'swc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: {
        '@swc/helpers': expect.any(String),
        '@swc/core': expect.any(String),
        'swc-loader': expect.any(String),
      },
    });
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

  it('should support tsc', () => {
    ensureDependencies(tree, { compiler: 'tsc' });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toEqual({
      name: expect.any(String),
      dependencies: {},
      devDependencies: { tslib: expect.any(String) },
    });
  });
});
