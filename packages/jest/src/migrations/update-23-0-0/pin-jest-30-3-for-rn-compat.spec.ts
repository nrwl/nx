import { readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './pin-jest-30-3-for-rn-compat';

describe('pin-jest-30-3-for-rn-compat', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('pins jest, babel-jest, and @types/jest when the workspace is on jest 30', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        jest: '^30.0.2',
        'babel-jest': '^30.0.2',
        '@types/jest': '^30.0.0',
      },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: '~30.3.0',
      'babel-jest': '~30.3.0',
      '@types/jest': '~30.0.0',
    });
  });

  it('pins entries listed under dependencies as well', async () => {
    writeJson(tree, 'package.json', {
      dependencies: { jest: '^30.0.2' },
      devDependencies: { 'babel-jest': '^30.0.2' },
    });

    await migration(tree);

    const pkg = readJson(tree, 'package.json');
    expect(pkg.dependencies.jest).toBe('~30.3.0');
    expect(pkg.devDependencies['babel-jest']).toBe('~30.3.0');
  });

  it('is a no-op when jest is on major 29', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { jest: '^29.7.0', 'babel-jest': '^29.7.0' },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: '^29.7.0',
      'babel-jest': '^29.7.0',
    });
  });

  it('is a no-op when jest is missing entirely', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { typescript: '^5.0.0' },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      typescript: '^5.0.0',
    });
  });

  it('skips packages that already match the pinned range', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { jest: '~30.3.0', 'babel-jest': '~30.3.0' },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: '~30.3.0',
      'babel-jest': '~30.3.0',
    });
  });

  it('does not pin wildcard ranges that escape major 30', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: { jest: '*', 'babel-jest': '>=29.0.0' },
    });

    await migration(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      jest: '*',
      'babel-jest': '>=29.0.0',
    });
  });

  it('leaves non-semver ranges (e.g. file: links) untouched', async () => {
    writeJson(tree, 'package.json', {
      devDependencies: {
        jest: '^30.0.2',
        'babel-jest': 'file:./vendor/babel-jest',
      },
    });

    await migration(tree);

    const pkg = readJson(tree, 'package.json');
    expect(pkg.devDependencies.jest).toBe('~30.3.0');
    expect(pkg.devDependencies['babel-jest']).toBe('file:./vendor/babel-jest');
  });
});
