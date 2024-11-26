import 'nx/src/internal-testing-utils/mock-project-graph';

import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { detoxInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
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
