import { readJson, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '../../generators/library/library';
import { removeStyledJsxBabelConfig } from './remove-styled-jsx-babel-plugin';

describe('Remove styled-jsx babel plugin for Next libs', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();

    await libraryGenerator(tree, {
      name: 'test-lib',
      style: 'styled-jsx',
      skipFormat: false,
      skipTsConfig: false,
      linter: Linter.EsLint,
      unitTestRunner: 'jest',
    });
  });

  it('should remove styled-jsx babel plugin', async () => {
    tree.write(
      'libs/test-lib/.babelrc',
      JSON.stringify({
        presets: ['next/babel'],
        plugins: ['styled-jsx/babel'],
      })
    );

    await removeStyledJsxBabelConfig(tree);
    const result = readJson(tree, 'libs/test-lib/.babelrc');
    expect(result.plugins).toEqual([]);
  });
  it('should remove styled-jsx babel plugin but leave potentially other plugins in there', async () => {
    tree.write(
      'libs/test-lib/.babelrc',
      JSON.stringify({
        presets: ['next/babel'],
        plugins: [
          'some-other/plugin',
          'styled-jsx/babel',
          'some-storybook/plugin',
        ],
      })
    );

    await removeStyledJsxBabelConfig(tree);
    const result = readJson(tree, 'libs/test-lib/.babelrc');
    expect(result.plugins).toEqual([
      'some-other/plugin',
      'some-storybook/plugin',
    ]);
  });
});
