import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateWorkspace } from '@nrwl/workspace';
import { callRule, createEmptyWorkspace } from '@nrwl/workspace/testing';
import { serializeJson } from '@nrwl/devkit';
import type { Linter } from 'eslint';
import { runMigration } from '../../utils/testing';
import {
  updateExtendsAndRemoveDuplication,
  updateObjPropAndRemoveDuplication,
  updateOverridesAndRemoveDuplication,
  updateParserOptionsAndRemoveDuplication,
  updatePluginsAndRemoveDuplication,
} from './update-eslint-configs-to-use-nx-presets';

describe('Update ESLint config files to use preset configs which eslint-plugin-nx exports', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await callRule(
      updateWorkspace((workspace) => {
        workspace.projects.add({
          name: 'reactapp',
          root: 'apps/reactapp',
          sourceRoot: 'apps/reactapp/src',
          projectType: 'application',
          targets: {},
        });
        workspace.projects.add({
          name: 'notreactapp',
          root: 'apps/notreactapp',
          sourceRoot: 'apps/notreactapp/src',
          projectType: 'application',
          targets: {},
        });
        workspace.projects.add({
          name: 'reactlib',
          root: 'libs/reactlib',
          sourceRoot: 'apps/reactlib/src',
          projectType: 'library',
          targets: {},
        });
        workspace.projects.add({
          name: 'notreactlib',
          root: 'libs/notreactlib',
          sourceRoot: 'apps/notreactlib/src',
          projectType: 'library',
          targets: {},
        });
      }),
      tree
    );
  });

  it('should update the current (v10.3.0) root .eslintrc.json file to the use the eslint-plugin-nx shared config', async () => {
    tree.create(
      '.eslintrc.json',
      serializeJson({
        root: true,
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaVersion: 2018,
          sourceType: 'module',
          project: './tsconfig.*?.json',
        },
        ignorePatterns: ['**/*'],
        plugins: ['@typescript-eslint', '@nrwl/nx'],
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/eslint-recommended',
          'plugin:@typescript-eslint/recommended',
          'prettier',
          'prettier/@typescript-eslint',
        ],
        rules: {
          '@typescript-eslint/explicit-member-accessibility': 'off',
          '@typescript-eslint/explicit-module-boundary-types': 'off',
          '@typescript-eslint/explicit-function-return-type': 'off',
          '@typescript-eslint/no-parameter-properties': 'off',
          '@nrwl/nx/enforce-module-boundaries': [
            'error',
            {
              enforceBuildableLibDependency: true,
              allow: [],
              depConstraints: [
                { sourceTag: '*', onlyDependOnLibsWithTags: ['*'] },
              ],
            },
          ],
        },
        overrides: [
          {
            files: ['*.tsx'],
            rules: {
              '@typescript-eslint/no-unused-vars': 'off',
            },
          },
        ],
      })
    );

    const result = await runMigration(
      'update-eslint-configs-to-use-nx-presets',
      {},
      tree
    );
    expect(readJsonInTree(result, '.eslintrc.json')).toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "plugin:@nrwl/nx/typescript",
        ],
        "ignorePatterns": Array [
          "**/*",
        ],
        "parserOptions": Object {
          "project": "./tsconfig.*?.json",
        },
        "plugins": Array [
          "@nrwl/nx",
        ],
        "root": true,
        "rules": Object {
          "@nrwl/nx/enforce-module-boundaries": Array [
            "error",
            Object {
              "allow": Array [],
              "depConstraints": Array [
                Object {
                  "onlyDependOnLibsWithTags": Array [
                    "*",
                  ],
                  "sourceTag": "*",
                },
              ],
              "enforceBuildableLibDependency": true,
            },
          ],
        },
      }
    `);
  });

  it('should update any react eslint configs to use the appropriate shareable config', async () => {
    const reactESLintConfig = {
      rules: {
        'array-callback-return': 'warn',
        'dot-location': ['warn', 'property'],
        eqeqeq: ['warn', 'smart'],
        'new-parens': 'warn',
        'no-caller': 'warn',
        'no-cond-assign': ['warn', 'except-parens'],
        'no-const-assign': 'warn',
        'no-control-regex': 'warn',
        'no-delete-var': 'warn',
        'no-dupe-args': 'warn',
        'no-dupe-keys': 'warn',
        'no-duplicate-case': 'warn',
        'no-empty-character-class': 'warn',
        'no-empty-pattern': 'warn',
        'no-eval': 'warn',
        'no-ex-assign': 'warn',
        'no-extend-native': 'warn',
        'no-extra-bind': 'warn',
        'no-extra-label': 'warn',
        'no-fallthrough': 'warn',
        'no-func-assign': 'warn',
        'no-implied-eval': 'warn',
        'no-invalid-regexp': 'warn',
        'no-iterator': 'warn',
        'no-label-var': 'warn',
        'no-labels': ['warn', { allowLoop: true, allowSwitch: false }],
        'no-lone-blocks': 'warn',
        'no-loop-func': 'warn',
        'no-mixed-operators': [
          'warn',
          {
            groups: [
              ['&', '|', '^', '~', '<<', '>>', '>>>'],
              ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
              ['&&', '||'],
              ['in', 'instanceof'],
            ],
            allowSamePrecedence: false,
          },
        ],
        'no-multi-str': 'warn',
        'no-native-reassign': 'warn',
        'no-negated-in-lhs': 'warn',
        'no-new-func': 'warn',
        'no-new-object': 'warn',
        'no-new-symbol': 'warn',
        'no-new-wrappers': 'warn',
        'no-obj-calls': 'warn',
        'no-octal': 'warn',
        'no-octal-escape': 'warn',
        'no-redeclare': 'warn',
        'no-regex-spaces': 'warn',
        'no-restricted-syntax': ['warn', 'WithStatement'],
        'no-script-url': 'warn',
        'no-self-assign': 'warn',
        'no-self-compare': 'warn',
        'no-sequences': 'warn',
        'no-shadow-restricted-names': 'warn',
        'no-sparse-arrays': 'warn',
        'no-template-curly-in-string': 'warn',
        'no-this-before-super': 'warn',
        'no-throw-literal': 'warn',
        'no-restricted-globals': [
          'error',
          'addEventListener',
          'blur',
          'close',
          'closed',
          'confirm',
          'defaultStatus',
          'defaultstatus',
          'event',
          'external',
          'find',
          'focus',
          'frameElement',
          'frames',
          'history',
          'innerHeight',
          'innerWidth',
          'length',
          'location',
          'locationbar',
          'menubar',
          'moveBy',
          'moveTo',
          'name',
          'onblur',
          'onerror',
          'onfocus',
          'onload',
          'onresize',
          'onunload',
          'open',
          'opener',
          'opera',
          'outerHeight',
          'outerWidth',
          'pageXOffset',
          'pageYOffset',
          'parent',
          'print',
          'removeEventListener',
          'resizeBy',
          'resizeTo',
          'screen',
          'screenLeft',
          'screenTop',
          'screenX',
          'screenY',
          'scroll',
          'scrollbars',
          'scrollBy',
          'scrollTo',
          'scrollX',
          'scrollY',
          'self',
          'status',
          'statusbar',
          'stop',
          'toolbar',
          'top',
        ],
        'no-unexpected-multiline': 'warn',
        'no-unreachable': 'warn',
        'no-unused-expressions': 'off',
        'no-unused-labels': 'warn',
        'no-useless-computed-key': 'warn',
        'no-useless-concat': 'warn',
        'no-useless-escape': 'warn',
        'no-useless-rename': [
          'warn',
          {
            ignoreDestructuring: false,
            ignoreImport: false,
            ignoreExport: false,
          },
        ],
        'no-with': 'warn',
        'no-whitespace-before-property': 'warn',
        'react-hooks/exhaustive-deps': 'warn',
        'require-yield': 'warn',
        'rest-spread-spacing': ['warn', 'never'],
        strict: ['warn', 'never'],
        'unicode-bom': ['warn', 'never'],
        'use-isnan': 'warn',
        'valid-typeof': 'warn',
        'no-restricted-properties': [
          'error',
          {
            object: 'require',
            property: 'ensure',
            message:
              'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
          },
          {
            object: 'System',
            property: 'import',
            message:
              'Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting',
          },
        ],
        'getter-return': 'warn',
        'import/first': 'error',
        'import/no-amd': 'error',
        'import/no-webpack-loader-syntax': 'error',
        'react/forbid-foreign-prop-types': ['warn', { allowInPropTypes: true }],
        'react/jsx-no-comment-textnodes': 'warn',
        'react/jsx-no-duplicate-props': 'warn',
        'react/jsx-no-target-blank': 'warn',
        'react/jsx-no-undef': 'error',
        'react/jsx-pascal-case': ['warn', { allowAllCaps: true, ignore: [] }],
        'react/jsx-uses-react': 'warn',
        'react/jsx-uses-vars': 'warn',
        'react/no-danger-with-children': 'warn',
        'react/no-direct-mutation-state': 'warn',
        'react/no-is-mounted': 'warn',
        'react/no-typos': 'error',
        'react/react-in-jsx-scope': 'error',
        'react/require-render-return': 'error',
        'react/style-prop-object': 'warn',
        'react/jsx-no-useless-fragment': 'warn',
        'jsx-a11y/accessible-emoji': 'warn',
        'jsx-a11y/alt-text': 'warn',
        'jsx-a11y/anchor-has-content': 'warn',
        'jsx-a11y/anchor-is-valid': [
          'warn',
          { aspects: ['noHref', 'invalidHref'] },
        ],
        'jsx-a11y/aria-activedescendant-has-tabindex': 'warn',
        'jsx-a11y/aria-props': 'warn',
        'jsx-a11y/aria-proptypes': 'warn',
        'jsx-a11y/aria-role': 'warn',
        'jsx-a11y/aria-unsupported-elements': 'warn',
        'jsx-a11y/heading-has-content': 'warn',
        'jsx-a11y/iframe-has-title': 'warn',
        'jsx-a11y/img-redundant-alt': 'warn',
        'jsx-a11y/no-access-key': 'warn',
        'jsx-a11y/no-distracting-elements': 'warn',
        'jsx-a11y/no-redundant-roles': 'warn',
        'jsx-a11y/role-has-required-aria-props': 'warn',
        'jsx-a11y/role-supports-aria-props': 'warn',
        'jsx-a11y/scope': 'warn',
        'react-hooks/rules-of-hooks': 'error',
        'default-case': 'off',
        'no-dupe-class-members': 'off',
        'no-undef': 'off',
        '@typescript-eslint/consistent-type-assertions': 'warn',
        'no-array-constructor': 'off',
        '@typescript-eslint/no-array-constructor': 'warn',
        '@typescript-eslint/no-namespace': 'error',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': [
          'warn',
          {
            functions: false,
            classes: false,
            variables: false,
            typedefs: false,
          },
        ],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { args: 'none', ignoreRestSiblings: true },
        ],
        'no-useless-constructor': 'off',
        '@typescript-eslint/no-useless-constructor': 'warn',
        '@typescript-eslint/no-unused-expressions': [
          'error',
          {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: true,
          },
        ],
      },
      env: {
        browser: true,
        commonjs: true,
        es6: true,
        jest: true,
        node: true,
      },
      settings: { react: { version: 'detect' } },
      plugins: ['import', 'jsx-a11y', 'react', 'react-hooks'],
      extends: ['../../.eslintrc'],
      ignorePatterns: ['!**/*'],
    };

    const notReactESLintConfig = {
      extends: ['../../.eslintrc'],
      ignorePatterns: ['!**/*'],
      rules: {
        foo: ['error'],
      },
    };

    tree.create(
      'apps/reactapp/.eslintrc.json',
      serializeJson(reactESLintConfig)
    );

    tree.create(
      'apps/notreactapp/.eslintrc.json',
      serializeJson(notReactESLintConfig)
    );

    tree.create(
      'libs/reactlib/.eslintrc.json',
      serializeJson(reactESLintConfig)
    );

    tree.create(
      'libs/notreactlib/.eslintrc.json',
      serializeJson(notReactESLintConfig)
    );

    const result = await runMigration(
      'update-eslint-configs-to-use-nx-presets',
      {},
      tree
    );

    expect(readJsonInTree(result, 'apps/reactapp/.eslintrc.json'))
      .toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "plugin:@nrwl/nx/react",
          "../../.eslintrc",
        ],
        "ignorePatterns": Array [
          "!**/*",
        ],
        "rules": Object {},
      }
    `);

    expect(readJsonInTree(result, 'libs/reactlib/.eslintrc.json'))
      .toMatchInlineSnapshot(`
      Object {
        "extends": Array [
          "plugin:@nrwl/nx/react",
          "../../.eslintrc",
        ],
        "ignorePatterns": Array [
          "!**/*",
        ],
        "rules": Object {},
      }
    `);

    // No change expected in non-react projects
    expect(readJsonInTree(result, 'apps/notreactapp/.eslintrc.json')).toEqual(
      notReactESLintConfig
    );
    expect(readJsonInTree(result, 'libs/notreactlib/.eslintrc.json')).toEqual(
      notReactESLintConfig
    );
  });

  describe('utils', () => {
    describe('updatePluginsAndRemoveDuplication()', () => {
      interface TestCase {
        json: Linter.Config;
        configBeingExtended: Linter.Config;
        ensurePlugin: string;
        expectedJSON: Linter.Config;
      }

      const testCases: TestCase[] = [
        {
          json: {
            plugins: [],
          },
          configBeingExtended: {
            plugins: ['@typescript-eslint'],
          },
          ensurePlugin: '@nrwl/nx',
          expectedJSON: {
            plugins: ['@nrwl/nx'],
          },
        },
        {
          json: {},
          configBeingExtended: {
            plugins: ['@typescript-eslint'],
          },
          ensurePlugin: '@nrwl/nx',
          expectedJSON: {
            plugins: ['@nrwl/nx'],
          },
        },
        {
          json: {
            plugins: ['@typescript-eslint', '@nrwl/nx'],
          },
          configBeingExtended: {
            plugins: ['@typescript-eslint'],
          },
          ensurePlugin: '@nrwl/nx',
          expectedJSON: {
            plugins: ['@nrwl/nx'],
          },
        },
        {
          json: {
            plugins: ['@typescript-eslint', 'some-entirely-custom-user-plugin'],
          },
          configBeingExtended: {
            plugins: ['@typescript-eslint'],
          },
          ensurePlugin: '@nrwl/nx',
          expectedJSON: {
            plugins: ['@nrwl/nx', 'some-entirely-custom-user-plugin'],
          },
        },
      ];

      testCases.forEach((tc, i) => {
        it(`should remove duplication between the plugins array of the first-party config and the config being extended, CASE ${i}`, () => {
          updatePluginsAndRemoveDuplication(
            tc.json,
            tc.configBeingExtended,
            true,
            tc.ensurePlugin
          );
          expect(tc.json).toEqual(tc.expectedJSON);
        });
      });
    });

    describe('updateExtendsAndRemoveDuplication()', () => {
      interface TestCase {
        json: Linter.Config;
        configBeingExtended: Linter.Config;
        extendsToAdd: string;
        expectedJSON: Linter.Config;
      }

      const testCases: TestCase[] = [
        {
          json: {
            extends: 'eslint:recommended',
          },
          configBeingExtended: {
            extends: [
              'eslint:recommended',
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
              'prettier',
              'prettier/@typescript-eslint',
            ],
          },
          extendsToAdd: 'plugin:@nrwl/nx/typescript',
          expectedJSON: {
            extends: ['plugin:@nrwl/nx/typescript'],
          },
        },
        {
          json: {
            extends: [
              'eslint:recommended',
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
              'prettier',
              'prettier/@typescript-eslint',
            ],
          },
          configBeingExtended: {
            extends: [
              'eslint:recommended',
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
              'prettier',
              'prettier/@typescript-eslint',
            ],
          },
          extendsToAdd: 'plugin:@nrwl/nx/typescript',
          expectedJSON: {
            extends: ['plugin:@nrwl/nx/typescript'],
          },
        },
        {
          json: {
            extends: ['eslint:recommended', 'something-custom'],
          },
          configBeingExtended: {
            extends: [
              'eslint:recommended',
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
              'prettier',
              'prettier/@typescript-eslint',
            ],
          },
          extendsToAdd: 'plugin:@nrwl/nx/typescript',
          expectedJSON: {
            extends: ['plugin:@nrwl/nx/typescript', 'something-custom'],
          },
        },
      ];

      testCases.forEach((tc, i) => {
        it(`should remove duplication between the extends array of the first-party config and the config being extended, CASE ${i}`, () => {
          updateExtendsAndRemoveDuplication(
            tc.json,
            tc.configBeingExtended,
            true,
            tc.extendsToAdd
          );
          expect(tc.json).toEqual(tc.expectedJSON);
        });
      });
    });

    describe('updateParserOptionsAndRemoveDuplication()', () => {
      interface TestCase {
        json: Linter.Config;
        configBeingExtended: Linter.Config;
        expectedJSON: Linter.Config;
      }

      const testCases: TestCase[] = [
        {
          json: {},
          configBeingExtended: {},
          expectedJSON: {
            parserOptions: {},
          },
        },
        {
          json: {
            parserOptions: {
              ecmaVersion: 2018,
            },
          },
          configBeingExtended: {
            parserOptions: {
              ecmaVersion: 2020,
            },
          },
          expectedJSON: {
            parserOptions: {},
          },
        },
        {
          json: {
            parserOptions: {
              // Strings will work (in spite of the type info)
              ecmaVersion: '2020' as any,
            },
          },
          configBeingExtended: {
            parserOptions: {
              ecmaVersion: 2020,
            },
          },
          expectedJSON: {
            parserOptions: {},
          },
        },
        {
          json: {
            parserOptions: {
              // Made up value
              ecmaVersion: 2021 as any,
            },
          },
          configBeingExtended: {
            parserOptions: {
              ecmaVersion: 2020,
            },
          },
          expectedJSON: {
            parserOptions: {
              // Made up value
              ecmaVersion: 2021 as any,
            },
          },
        },
        {
          json: {
            parserOptions: {
              project: './tsconfig.*?.json',
              sourceType: 'module',
            },
          },
          configBeingExtended: {
            parserOptions: {
              sourceType: 'module',
              foo: true,
              bar: true,
            },
          },
          expectedJSON: {
            parserOptions: {
              project: './tsconfig.*?.json',
            },
          },
        },
      ];

      testCases.forEach((tc, i) => {
        it(`should remove duplication between the parserOptions of the first-party config and the config being extended, CASE ${i}`, () => {
          updateParserOptionsAndRemoveDuplication(
            tc.json,
            tc.configBeingExtended
          );
          expect(tc.json).toEqual(tc.expectedJSON);
        });
      });
    });

    describe('updateObjPropAndRemoveDuplication()', () => {
      interface TestCase {
        json: Linter.Config;
        configBeingExtended: Linter.Config;
        objPropName: string;
        deleteIfUltimatelyEmpty: boolean;
        expectedJSON: Linter.Config;
      }

      const testCases: TestCase[] = [
        {
          json: {},
          configBeingExtended: {},
          objPropName: 'rules',
          deleteIfUltimatelyEmpty: false,
          expectedJSON: {
            rules: {},
          },
        },
        {
          json: {},
          configBeingExtended: {},
          objPropName: 'rules',
          deleteIfUltimatelyEmpty: true,
          expectedJSON: {},
        },
        {
          json: {
            rules: {
              '@typescript-eslint/explicit-member-accessibility': 'off',
              '@typescript-eslint/explicit-module-boundary-types': 'off',
              '@typescript-eslint/explicit-function-return-type': 'off',
              '@typescript-eslint/no-parameter-properties': 'off',
            },
          },
          configBeingExtended: {
            rules: {
              '@typescript-eslint/explicit-member-accessibility': 'off',
              '@typescript-eslint/explicit-module-boundary-types': 'off',
              '@typescript-eslint/explicit-function-return-type': 'off',
              '@typescript-eslint/no-parameter-properties': 'off',
            },
          },
          objPropName: 'rules',
          deleteIfUltimatelyEmpty: false,
          expectedJSON: {
            rules: {},
          },
        },
        {
          json: {
            rules: {
              'extra-rule-in-first-party': 'error',
              'rule-1-same-despite-options-order': [
                'error',
                { configOption1: true, configOption2: 'SOMETHING' },
              ],
              'rule-2-different-severity': ['off'],
              'rule-3-same-severity-different-options': [
                'error',
                {
                  a: false,
                },
              ],
            },
          },
          configBeingExtended: {
            rules: {
              'extra-rule-in-extended': 'error',
              'rule-1-same-despite-options-order': [
                'error',
                { configOption2: 'SOMETHING', configOption1: true },
              ],
              'rule-2-different-severity': ['error'],
              'rule-3-same-severity-different-options': [
                'error',
                {
                  a: true,
                },
              ],
            },
          },
          objPropName: 'rules',
          deleteIfUltimatelyEmpty: false,
          expectedJSON: {
            rules: {
              'extra-rule-in-first-party': 'error',
              'rule-2-different-severity': ['off'],
              'rule-3-same-severity-different-options': [
                'error',
                {
                  a: false,
                },
              ],
            },
          },
        },
        {
          json: {
            settings: { react: { version: 'detect' } },
          },
          configBeingExtended: {
            settings: { react: { version: 'detect' } },
          },
          objPropName: 'settings',
          deleteIfUltimatelyEmpty: true,
          expectedJSON: {},
        },
        {
          json: {
            // Different env in first party config
            env: {
              browser: true,
              commonjs: false,
              es6: false,
              jest: true,
              node: true,
            },
          },
          configBeingExtended: {
            env: {
              browser: true,
              commonjs: true,
              es6: true,
              jest: true,
              node: false,
            },
          },
          objPropName: 'env',
          deleteIfUltimatelyEmpty: true,
          expectedJSON: {
            env: {
              commonjs: false,
              es6: false,
              node: true,
            },
          },
        },
      ];

      testCases.forEach((tc, i) => {
        it(`should remove duplication between the object property of the first-party config and the config being extended, CASE ${i}`, () => {
          updateObjPropAndRemoveDuplication(
            tc.json,
            tc.configBeingExtended,
            tc.objPropName,
            tc.deleteIfUltimatelyEmpty
          );
          expect(tc.json).toEqual(tc.expectedJSON);
        });
      });
    });

    describe('updateOverridesAndRemoveDuplication()', () => {
      interface TestCase {
        json: Linter.Config;
        configBeingExtended: Linter.Config;
        expectedJSON: Linter.Config;
      }

      const testCases: TestCase[] = [
        {
          json: {},
          configBeingExtended: {},
          expectedJSON: {},
        },
      ];

      testCases.forEach((tc, i) => {
        it(`should remove duplication between the overrides of the first-party config and the config being extended, CASE ${i}`, () => {
          updateOverridesAndRemoveDuplication(
            tc.json,
            tc.configBeingExtended,
            true
          );
          expect(tc.json).toEqual(tc.expectedJSON);
        });
      });
    });
  });
});
