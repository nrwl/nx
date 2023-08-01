import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, updateJson } from '@nx/devkit';

import { convertToFlatConfigGenerator } from './generator';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { lintProjectGenerator } from '../lint-project/lint-project';
import { Linter } from '../utils/linter';

describe('convert-to-flat-config generator', () => {
  let tree: Tree;
  const options: ConvertToFlatConfigGeneratorSchema = { skipFormat: false };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      targets: {},
    });
  });

  it('should run successfully', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.exists('eslint.config.js')).toBeTruthy();
    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.exists('libs/test-lib/eslint.config.js')).toBeTruthy();
    expect(
      tree.read('libs/test-lib/eslint.config.js', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should add global gitignores', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    tree.write('.eslintignore', 'ignore/me');
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add plugins', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.plugins = [
        'eslint-plugin-import',
        'single-name',
        '@scope/with-name',
        '@just-scope',
      ];
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add parser', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.parser = '@typescript-eslint/parser';
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });
});
