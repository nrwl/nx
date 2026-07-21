import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { readJson, readNxJson, Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nuxtInitGenerator } from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should install required dependencies', async () => {
    await nuxtInitGenerator(tree, {
      skipFormat: false,
    });
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toMatchSnapshot();
  });

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should not add targets', async () => {
    await nuxtInitGenerator(tree, {
      skipFormat: false,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toMatchObject([
      {
        options: { buildTargetName: 'build', serveTargetName: 'serve' },
        plugin: '@nx/nuxt/plugin',
      },
    ]);
  });

  it('should not overwrite an existing nuxt version (keepExistingVersions defaults to true)', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...(json.devDependencies ?? {}),
        nuxt: '3.15.0',
      };
      return json;
    });

    // Invoked without `keepExistingVersions` (as the application generator
    // does); the init should default it to true rather than bump.
    await nuxtInitGenerator(tree, { skipFormat: true });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.nuxt).toBe('3.15.0');
  });
});
