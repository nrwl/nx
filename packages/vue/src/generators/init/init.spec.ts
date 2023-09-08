import { readJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { vueInitGenerator } from './init';
import { InitSchema } from './schema';

// TODO: more or different to be added here
describe('init', () => {
  let tree: Tree;
  let schema: InitSchema = {
    skipFormat: false,
    unitTestRunner: 'vitest',
    routing: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add vue dependencies', async () => {
    await vueInitGenerator(tree, schema);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson).toMatchSnapshot();
  });
});
