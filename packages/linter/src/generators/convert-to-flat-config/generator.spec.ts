import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  readJson,
  updateJson,
} from '@nx/devkit';

import { convertToFlatConfigGenerator } from './generator';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { lintProjectGenerator } from '../lint-project/lint-project';
import { Linter } from '../utils/linter';
import { eslintrcVersion } from '../../utils/versions';

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
    expect(
      readJson(tree, 'libs/test-lib/project.json').targets.lint.options
        .eslintConfig
    ).toEqual('libs/test-lib/eslint.config.js');
  });

  it('should add plugin extends', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.extends = ['plugin:storybook/recommended'];
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const nxEslintPlugin = require('@nx/eslint-plugin');
      const { FlatCompat } = require('@eslint/eslintrc');
      const compat = new FlatCompat({
        baseDirectory: __dirname,
      });
      module.exports = [
        ...compat.extends('plugin:storybook/recommended'),
        { plugins: { '@nx': nxEslintPlugin } },
        {
          files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
          rules: {
            '@nx/enforce-module-boundaries': [
              'error',
              {
                enforceBuildableLibDependency: true,
                allow: [],
                depConstraints: [
                  {
                    sourceTag: '*',
                    onlyDependOnLibsWithTags: ['*'],
                  },
                ],
              },
            ],
          },
        },
        {
          files: ['**/*.ts', '**/*.tsx'],
          extends: ['plugin:@nx/typescript'],
          rules: {},
        },
        {
          files: ['**/*.js', '**/*.jsx'],
          extends: ['plugin:@nx/javascript'],
          rules: {},
        },
      ];
      "
    `);
    expect(tree.read('libs/test-lib/eslint.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const baseConfig = require('../../eslint.config.js');
      module.exports = [
        ...baseConfig,
        {
          files: [
            'libs/test-lib/**/*.ts',
            'libs/test-lib/**/*.tsx',
            'libs/test-lib/**/*.js',
            'libs/test-lib/**/*.jsx',
          ],
          rules: {},
        },
        {
          files: ['libs/test-lib/**/*.ts', 'libs/test-lib/**/*.tsx'],
          rules: {},
        },
        {
          files: ['libs/test-lib/**/*.js', 'libs/test-lib/**/*.jsx'],
          rules: {},
        },
      ];
      "
    `);
    expect(
      readJson(tree, 'package.json').devDependencies['@eslint/eslintrc']
    ).toEqual(eslintrcVersion);
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

  it('should add settings', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.settings = {
        sharedData: 'Hello',
      };
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add env configuration', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.env = {
        browser: true,
        node: true,
      };
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add global configuration', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.globals = {
        myCustomGlobal: 'readonly',
      };
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchSnapshot();
  });

  it('should add global and env configuration', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.globals = {
        myCustomGlobal: 'readonly',
      };
      json.env = {
        browser: true,
      };
      return json;
    });
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

  it('should add linter options', async () => {
    await lintProjectGenerator(tree, {
      skipFormat: false,
      linter: Linter.EsLint,
      eslintFilePatterns: ['**/*.ts'],
      project: 'test-lib',
      setParserOptionsProject: false,
    });
    updateJson(tree, '.eslintrc.json', (json) => {
      json.noInlineConfig = true;
      return json;
    });
    await convertToFlatConfigGenerator(tree, options);

    expect(tree.read('eslint.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const nxEslintPlugin = require('@nx/eslint-plugin');
      module.exports = [
        { plugins: { '@nx': nxEslintPlugin } },
        {
          linterOptions: {
            noInlineConfig: true,
          },
        },
        {
          files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
          rules: {
            '@nx/enforce-module-boundaries': [
              'error',
              {
                enforceBuildableLibDependency: true,
                allow: [],
                depConstraints: [
                  {
                    sourceTag: '*',
                    onlyDependOnLibsWithTags: ['*'],
                  },
                ],
              },
            ],
          },
        },
        {
          files: ['**/*.ts', '**/*.tsx'],
          extends: ['plugin:@nx/typescript'],
          rules: {},
        },
        {
          files: ['**/*.js', '**/*.jsx'],
          extends: ['plugin:@nx/javascript'],
          rules: {},
        },
      ];
      "
    `);
  });
});
