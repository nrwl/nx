import { Tree, readJson, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { expoInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should add react native dependencies', async () => {
    await expoInitGenerator(tree, { e2eTestRunner: 'none' });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['expo']).toBeDefined();
    expect(packageJson.dependencies['react-native']).toBeDefined();
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
    await expoInitGenerator(tree, { e2eTestRunner: 'none' });

    const content = tree.read('/.gitignore').toString();

    expect(content).toMatch(/# Expo/);
  });

  describe('defaultCollection', () => {
    it('should be set if none was set before', async () => {
      await expoInitGenerator(tree, { e2eTestRunner: 'none' });
      const { cli } = readJson(tree, 'nx.json');
      expect(cli.defaultCollection).toEqual('@nrwl/expo');
    });

    it('should not be set if something else was set before', async () => {
      updateJson(tree, 'nx.json', (json) => {
        json.cli = {
          defaultCollection: '@nrwl/react',
        };

        json.targets = {};

        return json;
      });
      await expoInitGenerator(tree, { e2eTestRunner: 'none' });
      const { cli } = readJson(tree, 'nx.json');
      expect(cli.defaultCollection).toEqual('@nrwl/react');
    });
  });
});
