import { logger } from '@nrwl/devkit';
import { Tree, readJson, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { reactNativeInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should add react native dependencies', async () => {
    await reactNativeInitGenerator(tree, { e2eTestRunner: 'none' });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-native']).toBeDefined();
    expect(packageJson.devDependencies['@types/node']).toBeDefined();
    expect(packageJson.devDependencies['@types/react']).toBeDefined();
    expect(packageJson.devDependencies['@types/react-native']).toBeDefined();
  });

  it('should add .gitignore entries for React native files and directories', async () => {
    tree.write(
      '/.gitignore',
      `
/node_modules
`
    );
    await reactNativeInitGenerator(tree, { e2eTestRunner: 'none' });

    const content = tree.read('/.gitignore').toString();

    expect(content).toMatch(/# React Native/);
    expect(content).toMatch(/# Nested node_modules/);
  });

  describe('babel config', () => {
    it('should create babel config if not present', async () => {
      await reactNativeInitGenerator(tree, {
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
      });
      expect(tree.exists('babel.config.json')).toBe(true);
    });

    it('should not overwrite existing babel config', async () => {
      tree.write('babel.config.json', '{ "preset": ["preset-awesome"] }');

      await reactNativeInitGenerator(tree, {
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
      });

      const existing = readJson(tree, 'babel.config.json');
      expect(existing).toEqual({ preset: ['preset-awesome'] });
    });

    it('should not overwrite existing babel config (.js)', async () => {
      tree.write('/babel.config.js', 'module.exports = () => {};');
      await reactNativeInitGenerator(tree, {
        unitTestRunner: 'none',
        e2eTestRunner: 'none',
      });
      expect(tree.exists('babel.config.json')).toBe(false);
    });
  });
});
