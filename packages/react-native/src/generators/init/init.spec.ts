import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { reactNativeInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should add react native dependencies', async () => {
    await reactNativeInitGenerator(tree, {
      addPlugin: true,
    });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['react-native']).toBeDefined();
  });

  it('should add .gitignore entries for React native files and directories', async () => {
    tree.write(
      '/.gitignore',
      `
/node_modules
`
    );
    await reactNativeInitGenerator(tree, {
      addPlugin: true,
    });

    const content = tree.read('/.gitignore').toString();

    expect(content).toMatch(/# React Native/);
    expect(content).toMatch(/# Nested node_modules/);
  });
});
