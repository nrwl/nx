import {
  addExtendsToLintConfig,
  findEslintFile,
  lintConfigHasOverride,
} from './eslint-file';

import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  ESLINT_CONFIG_FILENAMES,
  baseEsLintConfigFile,
} from '../../utils/config-file';

describe('@nx/eslint:lint-file', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('findEslintFile', () => {
    it('should return null when calling findEslintFile when no eslint is found', () => {
      expect(findEslintFile(tree)).toBe(null);
    });

    test.each(ESLINT_CONFIG_FILENAMES)(
      'should return %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(eslintFileName);
      }
    );

    test.each(ESLINT_CONFIG_FILENAMES)(
      'should return base file instead %p when calling findEslintFile',
      (eslintFileName) => {
        tree.write(baseEsLintConfigFile, '{}');
        tree.write(eslintFileName, '{}');
        expect(findEslintFile(tree)).toBe(baseEsLintConfigFile);
      }
    );
  });

  describe('lintConfigHasOverride', () => {
    it('should return true when override exists in eslintrc format', () => {
      tree.write(
        '.eslintrc.json',
        '{"overrides": [{ "files": ["*.ts"], "rules": {} }]}'
      );
      expect(
        lintConfigHasOverride(
          tree,
          '.',
          (o) => {
            return o.files?.includes('*.ts');
          },
          false
        )
      ).toBe(true);
    });

    it('should return false when eslintrc is not in JSON format', () => {
      tree.write(
        '.eslintrc.js',
        'module.exports = {overrides: [{ files: ["*.ts"], rules: {} }]};'
      );
      expect(
        lintConfigHasOverride(
          tree,
          '.',
          (o) => {
            return o.files?.includes('*.ts');
          },
          false
        )
      ).toBe(false);
    });
  });

  describe('addExtendsToLintConfig', () => {
    it('should update string extends property to array', () => {
      tree.write(
        'apps/demo/.eslintrc.json',
        JSON.stringify({
          extends: '../../.eslintrc',
          rules: {},
          overrides: [
            {
              files: ['**/*.ts', '**/*.tsx'],
              rules: {
                '@typescript-eslint/no-unused-vars': 'off',
              },
            },
            {
              files: ['./package.json'],
              parser: 'jsonc-eslint-parser',
              rules: {
                '@nx/dependency-checks': [
                  'error',
                  {
                    buildTargets: ['build'],
                    includeTransitiveDependencies: true,
                    ignoredFiles: [
                      '{projectRoot}/remix.config.js',
                      '{projectRoot}/tailwind.config.js',
                    ],
                    ignoredDependencies: ['saslprep'],
                  },
                ],
              },
            },
          ],
          ignorePatterns: ['!**/*', 'build/**/*'],
        })
      );
      addExtendsToLintConfig(tree, 'apps/demo', 'plugin:playwright/recommend');
      expect(readJson(tree, 'apps/demo/.eslintrc.json').extends).toEqual([
        'plugin:playwright/recommend',
        '../../.eslintrc',
      ]);
    });
  });
});
