import { readJson, type NxJsonConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initGenerator } from './init';

describe('@nx/storybook:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add build-storybook to cacheable operations if NX_ADD_PLUGINS=false', async () => {
    await initGenerator(tree, {
      addPlugin: false,
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults['build-storybook'].cache).toEqual(true);
    delete process.env.NX_ADD_PLUGINS;
  });

  it('should add storybook-static to .gitignore', async () => {
    tree.write('.gitignore', '');
    await initGenerator(tree, {
      addPlugin: true,
    });
    expect(tree.read('.gitignore', 'utf-8')).toContain('storybook-static');
  });

  it('should not add storybook-static to .gitignore if it already exists', async () => {
    tree.write(
      '.gitignore',
      `
    storybook-static
    dist
    node_modules
  `
    );
    await initGenerator(tree, {
      addPlugin: true,
    });
    expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
  });
});
