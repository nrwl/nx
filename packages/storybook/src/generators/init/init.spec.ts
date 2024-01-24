import { readJson, type NxJsonConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { initGenerator } from './init';

describe('@nx/storybook:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add build-storybook to cacheable operations', async () => {
    await initGenerator(tree, {});
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(nxJson.targetDefaults['build-storybook'].cache).toEqual(true);
  });

  it('should add storybook-static to .gitignore', async () => {
    process.env.NX_PCV3 = 'true';
    tree.write('.gitignore', '');
    await initGenerator(tree, {});
    expect(tree.read('.gitignore', 'utf-8')).toContain('storybook-static');
    delete process.env.NX_PCV3;
  });

  it('should not add storybook-static to .gitignore if it already exists', async () => {
    process.env.NX_PCV3 = 'true';
    tree.write(
      '.gitignore',
      `
    storybook-static
    dist
    node_modules
  `
    );
    await initGenerator(tree, {});
    expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
    delete process.env.NX_PCV3;
  });
});
