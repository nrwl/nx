import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readJson, Tree } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { expoInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  it('should deny the build scripts pulled in through @nx/detox', async () => {
    await withPnpm(tree, '11.2.2', () => expoInitGenerator(tree, {}));

    const pnpmWorkspace = tree.read('pnpm-workspace.yaml', 'utf-8');
    expect(pnpmWorkspace).toMatch(/['"]?@parcel\/watcher['"]?: false/);
    expect(pnpmWorkspace).toMatch(/['"]?unrs-resolver['"]?: false/);
  });

  it('should add react native dependencies', async () => {
    await expoInitGenerator(tree, {});
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['react']).toBeDefined();
    expect(packageJson.dependencies['expo']).toBeDefined();
    expect(packageJson.dependencies['react-native']).toBeDefined();
  });

  it('should add .gitignore entries for React native files and directories', async () => {
    tree.write(
      '/.gitignore',
      `
/node_modules
`
    );
    await expoInitGenerator(tree, {});

    const content = tree.read('/.gitignore').toString();

    expect(content).toMatch(/# Expo/);
  });
});
