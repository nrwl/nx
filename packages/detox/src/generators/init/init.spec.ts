import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { Tree, readJson } from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { detoxInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should record the build script decisions detox pulls in', async () => {
    await withPnpm(tree, '11.2.2', () =>
      detoxInitGenerator(tree, { addPlugin: true })
    );

    const pnpmWorkspace = tree.read('pnpm-workspace.yaml', 'utf-8');
    expect(pnpmWorkspace).toMatch(/['"]?detox['"]?: true/);
    expect(pnpmWorkspace).toMatch(/['"]?dtrace-provider['"]?: false/);
    expect(pnpmWorkspace).toMatch(/['"]?unrs-resolver['"]?: false/);
  });

  it('should add detox dependencies', async () => {
    await detoxInitGenerator(tree, {
      addPlugin: true,
    });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nx/detox']).toBeDefined();
    expect(packageJson.devDependencies['detox']).toBeDefined();
  });
});
