import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, Tree, writeJson } from '@nx/devkit';

import { generatorGenerator } from './generator';
import { setCwd } from '@nx/devkit/internal-testing-utils';

describe('create-nodes-plugin/generator generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'eslint', {
      root: 'packages/eslint',
      targets: {
        build: {},
      },
    });

    writeJson(tree, 'packages/eslint/package.json', {});

    jest.spyOn(process, 'cwd').mockReturnValue('/virtual/packages/eslint');

    setCwd('packages/eslint');
  });

  it('should run successfully', async () => {
    await generatorGenerator(tree);
    expect(
      tree.read('packages/eslint/src/plugins/plugin.ts').toString()
    ).toMatchSnapshot();
    expect(
      tree.read('packages/eslint/src/plugins/plugin.spec.ts').toString()
    ).toMatchSnapshot();
    expect(
      tree
        .read(
          'packages/eslint/src/migrations/update-17-2-0/add-eslint-plugin.ts'
        )
        .toString()
    ).toMatchSnapshot();
  });
});
