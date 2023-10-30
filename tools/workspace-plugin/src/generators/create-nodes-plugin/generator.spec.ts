import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

import { generatorGenerator, GeneratorGeneratorSchema } from './generator';

describe('create-nodes-plugin/generator generator', () => {
  let tree: Tree;
  const options: GeneratorGeneratorSchema = {};

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    jest.spyOn(process, 'cwd').mockReturnValue('/virtual/packages/eslint');
  });

  it('should run successfully', async () => {
    await generatorGenerator(tree, options);
    expect(
      tree.read('packages/eslint/src/plugins/plugin.ts').toString()
    ).toMatchSnapshot();
    expect(
      tree.read('packages/eslint/src/plugins/plugin.spec.ts').toString()
    ).toMatchSnapshot();
  });
});
