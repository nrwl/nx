import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { Tree, readJson } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { reactNativeInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should deny the build scripts pulled in through @nx/detox', async () => {
    await withPnpm(tree, '11.2.2', () =>
      reactNativeInitGenerator(tree, { addPlugin: true })
    );

    const pnpmWorkspace = tree.read('pnpm-workspace.yaml', 'utf-8');
    expect(pnpmWorkspace).toMatch(/['"]?@parcel\/watcher['"]?: false/);
    expect(pnpmWorkspace).toMatch(/['"]?unrs-resolver['"]?: false/);
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
