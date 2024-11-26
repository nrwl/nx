import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { monorepoGenerator } from './convert-to-monorepo';

describe('monorepo generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should convert a root package without a project.json', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.name = 'demo';
      // Make this a root project
      json.nx = {};
      return json;
    });

    await monorepoGenerator(tree, {});

    expect(tree.exists('packages/demo/project.json')).toBeTruthy();
    expect(readProjectConfiguration(tree, 'demo')).toMatchObject({
      name: 'demo',
    });
    expect(readJson(tree, 'package.json').name).toBe('@demo/source');
  });
});
