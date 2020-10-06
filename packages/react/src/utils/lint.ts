import {
  eslintPluginImportVersion,
  eslintPluginReactVersion,
  eslintPluginReactHooksVersion,
  eslintPluginJsxA11yVersion,
} from './versions';
import * as restrictedGlobals from 'confusing-browser-globals';

export const extraEslintDependencies = {
  dependencies: {},
  devDependencies: {
    'eslint-plugin-import': eslintPluginImportVersion,
    'eslint-plugin-jsx-a11y': eslintPluginJsxA11yVersion,
    'eslint-plugin-react': eslintPluginReactVersion,
    'eslint-plugin-react-hooks': eslintPluginReactHooksVersion,
  },
};

/**
 * Rule set used by this utility originally adapted from:
 * https://github.com/facebook/create-react-app/blob/567f36c9235f1e1fd4a76dc6d1ae00be754ca047/packages/eslint-config-react-app/index.js
 */
export const createReactEslintJson = (options: {
  js: boolean;
  parserOptionsProject: string[];
}) => {
  const generalCodeConfig = createGeneralCodeConfig();
  const jsxSpecificConfig = createJSXSpecificConfig();

  const {
    plugins: generalCodePlugins,
    env: generalCodeEnv,
    rules: generalCodeRules,
  } = generalCodeConfig;
  const {
    plugins: jsxSpecificPlugins,
    settings: jsxSpecificSettings,
    rules: jsxSpecificRules,
  } = jsxSpecificConfig;

  /**
   * For the standard TypeScript use-case, we have general config that applies to all
   * TypeScript files within the project, and some separate config which is specific to JSX/React.
   *
   * In other relevant configs, such as the tsconfig files, Nx has decided to support including
   * any ts, tsx, js and jsx files, to allow for easier migration of existing projects, so we also
   * include all of those file types in the linting config to match that.
   */
  return {
    env: generalCodeEnv,
    plugins: [...generalCodePlugins],
    rules: {
      ...generalCodeRules,
    },
    overrides: [
      {
        files: ['*.js', '*.jsx'],
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
        settings: jsxSpecificSettings,
        plugins: [...jsxSpecificPlugins],
        rules: {
          ...jsxSpecificRules,
        },
      },
      {
        files: ['*.ts', '*.tsx'],
        parserOptions: {
          project: options.parserOptionsProject,
        },
        rules: {
          ...typescriptSpecificRules,
        },
      },
      {
        files: ['*.tsx', '*.jsx'],
        ...jsxSpecificConfig,
      },
    ],
  };
};

function createJSXSpecificConfig() {
  return {
    settings: { react: { version: 'detect' } },
    plugins: ['jsx-a11y', 'react', 'react-hooks'],
    rules: {
      /**
       * React-specific rule configurations
       * https://github.com/yannickcr/eslint-plugin-react
       */
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

      /**
       * JSX Accessibility rule configurations
       * https://github.com/evcohen/eslint-plugin-jsx-a11y
       */
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

      /**
       * React Hooks rule configurations
       * https://github.com/facebook/react/tree/master/packages/eslint-plugin-react-hooks
       */
      'react-hooks/rules-of-hooks': 'error',
    },
  };
}

function createGeneralCodeConfig() {
  return {
    plugins: ['import'],
    env: {
      browser: true,
      commonjs: true,
      es6: true,
      jest: true,
      node: true,
    },
    rules: {
      /**
       * Standard ESLint rule configurations
       * https://eslint.org/docs/rules
       */
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
      'no-restricted-globals': ['error'].concat(restrictedGlobals),
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

      /**
       * Import rule configurations
       * https://github.com/benmosher/eslint-plugin-import
       */
      'import/first': 'error',
      'import/no-amd': 'error',
      'import/no-webpack-loader-syntax': 'error',
    },
  };
}

/**
 * TypeScript-specific rule configurations (in addition to @typescript-eslint:recommended)
 * https://github.com/typescript-eslint/typescript-eslint
 */
const typescriptSpecificRules = {
  // TypeScript"s `noFallthroughCasesInSwitch` option is more robust (#6906)
  'default-case': 'off',
  // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
  'no-dupe-class-members': 'off',
  // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
  'no-undef': 'off',

  // Add TypeScript specific rules (and turn off ESLint equivalents)
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
    {
      args: 'none',
      ignoreRestSiblings: true,
    },
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
};
