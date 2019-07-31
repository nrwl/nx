import { join } from '@angular-devkit/core';
import {
  chain,
  Rule,
  Tree,
  SchematicContext
} from '@angular-devkit/schematics';
import { addDepsToPackageJson } from './ast-utils';
import { offsetFromRoot } from './common';
import {
  eslintVersion,
  typescriptESLintVersion,
  eslintConfigPrettierVersion
} from './versions';

export function generateProjectLint(
  projectRoot: string,
  tsConfigPath: string,
  linter: 'tslint' | 'eslint' | 'none'
) {
  if (linter === 'tslint') {
    return {
      builder: '@nrwl/linter:lint',
      options: {
        linter: 'tslint',
        tsConfig: [tsConfigPath],
        exclude: ['**/node_modules/**', '!' + projectRoot + '/**']
      }
    };
  } else if (linter === 'eslint') {
    return {
      builder: '@nrwl/linter:lint',
      options: {
        linter: 'eslint',
        config: projectRoot + '/.eslintrc',
        tsConfig: [tsConfigPath],
        exclude: ['**/node_modules/**', '!' + projectRoot + '/**']
      }
    };
  } else {
    return undefined;
  }
}

export function addLintFiles(
  projectRoot: string,
  linter: 'tslint' | 'eslint' | 'none',
  onlyGlobal = false
): Rule {
  return (host: Tree, context: SchematicContext) => {
    if (linter === 'tslint') {
      if (!host.exists('/tslint.json')) {
        host.create('/tslint.json', globalTsLint);
      }
      if (!onlyGlobal) {
        host.create(
          join(projectRoot as any, `tslint.json`),
          JSON.stringify({
            extends: `${offsetFromRoot(projectRoot)}tslint.json`,
            rules: []
          })
        );
      }
      return;
    }

    if (linter === 'eslint') {
      if (!host.exists('/.eslintrc')) {
        host.create('/.eslintrc', globalESLint);
        addDepsToPackageJson(
          {},
          {
            '@typescript-eslint/parser': typescriptESLintVersion,
            '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
            eslint: eslintVersion,
            'eslint-config-prettier': eslintConfigPrettierVersion

            /**
             * REACT SPECIFIC PLUGINS USED IN CONFIG REACT SPECIFIC CONFIG BELOW
             *
             * NOTE: They will also need adding to the root package.json of this repo
             * when the time comes
             */
            // "eslint-plugin-import": "2.18.2",
            // "eslint-plugin-jsx-a11y": "6.2.3",
            // "eslint-plugin-react": "7.14.3",
            // "eslint-plugin-react-hooks": "1.6.1",
          }
        )(host, context);
      }
      if (!onlyGlobal) {
        host.create(
          join(projectRoot as any, `.eslintrc`),
          JSON.stringify({
            extends: `${offsetFromRoot(projectRoot)}.eslintrc`,
            rules: {}
          })
        );
      }
    }
  };
}

const globalTsLint = `
{
  "rulesDirectory": ["node_modules/@nrwl/workspace/src/tslint"],
  "rules": {
    "arrow-return-shorthand": true,
    "callable-types": true,
    "class-name": true,
    "deprecation": {
      "severity": "warn"
    },
    "forin": true,
    "import-blacklist": [true, "rxjs/Rx"],
    "interface-over-type-literal": true,
    "member-access": false,
    "member-ordering": [
      true,
      {
        "order": [
          "static-field",
          "instance-field",
          "static-method",
          "instance-method"
        ]
      }
    ],
    "no-arg": true,
    "no-bitwise": true,
    "no-console": [true, "debug", "info", "time", "timeEnd", "trace"],
    "no-construct": true,
    "no-debugger": true,
    "no-duplicate-super": true,
    "no-empty": false,
    "no-empty-interface": true,
    "no-eval": true,
    "no-inferrable-types": [true, "ignore-params"],
    "no-misused-new": true,
    "no-non-null-assertion": true,
    "no-shadowed-variable": true,
    "no-string-literal": false,
    "no-string-throw": true,
    "no-switch-case-fall-through": true,
    "no-unnecessary-initializer": true,
    "no-unused-expression": true,
    "no-var-keyword": true,
    "object-literal-sort-keys": false,
    "prefer-const": true,
    "radix": true,
    "triple-equals": [true, "allow-null-check"],
    "unified-signatures": true,
    "variable-name": false,

    "nx-enforce-module-boundaries": [
      true,
      {
        "allow": [],
        "depConstraints": [
          { "sourceTag": "*", "onlyDependOnLibsWithTags": ["*"] }
        ]
      }
    ]
  }
}
`;

const globalESLint = `
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "prettier/@typescript-eslint"
  ],
  "rules": {
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-parameter-properties": "off"
  },
  "overrides": [
    {
      "files": ["*.tsx"],
      "rules": {
        "@typescript-eslint/no-unused-vars": "off"
      }
    }
  ]
}
`;

/**
 * CONFIG FOR REACT WORKSPACES
 *
 * ADAPTED FROM https://github.com/facebook/create-react-app/blob/567f36c9235f1e1fd4a76dc6d1ae00be754ca047/packages/eslint-config-react-app/index.js
 */
// {
//   "parser": "@typescript-eslint/parser",
//   "parserOptions": {
//     "ecmaVersion": 2018,
//     "sourceType": "module",
//     "project": "./tsconfig.json"
//   },
//   "env": {
//     "browser": true,
//     "commonjs": true,
//     "es6": true,
//     "jest": true,
//     "node": true
//   },
//   "settings": {
//     "react": {
//       "version": "detect"
//     }
//   },
//   "plugins": ["@typescript-eslint", "import", "jsx-a11y", "react", "react-hooks"],
//   "extends": [
//     "eslint:recommended",
//     "plugin:@typescript-eslint/eslint-recommended",
//     "plugin:@typescript-eslint/recommended",
//     "prettier",
//     "prettier/@typescript-eslint"
//   ],

//   /**
//   * Inspired by configuration originally found in create-react-app
//   * https://github.com/facebook/create-react-app
//   */
//   "rules": {
//     /**
//      * Standard ESLint rule configurations
//      * https://eslint.org/docs/rules
//      */
//     "array-callback-return": "warn",
//     "dot-location": ["warn", "property"],
//     "eqeqeq": ["warn", "smart"],
//     "new-parens": "warn",
//     "no-caller": "warn",
//     "no-cond-assign": ["warn", "except-parens"],
//     "no-const-assign": "warn",
//     "no-control-regex": "warn",
//     "no-delete-var": "warn",
//     "no-dupe-args": "warn",
//     "no-dupe-keys": "warn",
//     "no-duplicate-case": "warn",
//     "no-empty-character-class": "warn",
//     "no-empty-pattern": "warn",
//     "no-eval": "warn",
//     "no-ex-assign": "warn",
//     "no-extend-native": "warn",
//     "no-extra-bind": "warn",
//     "no-extra-label": "warn",
//     "no-fallthrough": "warn",
//     "no-func-assign": "warn",
//     "no-implied-eval": "warn",
//     "no-invalid-regexp": "warn",
//     "no-iterator": "warn",
//     "no-label-var": "warn",
//     "no-labels": ["warn", { "allowLoop": true, "allowSwitch": false }],
//     "no-lone-blocks": "warn",
//     "no-loop-func": "warn",
//     "no-mixed-operators": [
//       "warn",
//       {
//         "groups": [
//           ["&", "|", "^", "~", "<<", ">>", ">>>"],
//           ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
//           ["&&", "||"],
//           ["in", "instanceof"],
//         ],
//         "allowSamePrecedence": false,
//       },
//     ],
//     "no-multi-str": "warn",
//     "no-native-reassign": "warn",
//     "no-negated-in-lhs": "warn",
//     "no-new-func": "warn",
//     "no-new-object": "warn",
//     "no-new-symbol": "warn",
//     "no-new-wrappers": "warn",
//     "no-obj-calls": "warn",
//     "no-octal": "warn",
//     "no-octal-escape": "warn",
//     "no-redeclare": "warn",
//     "no-regex-spaces": "warn",
//     "no-restricted-syntax": ["warn", "WithStatement"],
//     "no-script-url": "warn",
//     "no-self-assign": "warn",
//     "no-self-compare": "warn",
//     "no-sequences": "warn",
//     "no-shadow-restricted-names": "warn",
//     "no-sparse-arrays": "warn",
//     "no-template-curly-in-string": "warn",
//     "no-this-before-super": "warn",
//     "no-throw-literal": "warn",
//     "no-restricted-globals": [
//       "error",
//       [
//         "addEventListener",
//         "blur",
//         "close",
//         "closed",
//         "confirm",
//         "defaultStatus",
//         "defaultstatus",
//         "event",
//         "external",
//         "find",
//         "focus",
//         "frameElement",
//         "frames",
//         "history",
//         "innerHeight",
//         "innerWidth",
//         "length",
//         "location",
//         "locationbar",
//         "menubar",
//         "moveBy",
//         "moveTo",
//         "name",
//         "onblur",
//         "onerror",
//         "onfocus",
//         "onload",
//         "onresize",
//         "onunload",
//         "open",
//         "opener",
//         "opera",
//         "outerHeight",
//         "outerWidth",
//         "pageXOffset",
//         "pageYOffset",
//         "parent",
//         "print",
//         "removeEventListener",
//         "resizeBy",
//         "resizeTo",
//         "screen",
//         "screenLeft",
//         "screenTop",
//         "screenX",
//         "screenY",
//         "scroll",
//         "scrollbars",
//         "scrollBy",
//         "scrollTo",
//         "scrollX",
//         "scrollY",
//         "self",
//         "status",
//         "statusbar",
//         "stop",
//         "toolbar",
//         "top",
//       ]
//     ],
//     "no-unexpected-multiline": "warn",
//     "no-unreachable": "warn",
//     "no-unused-expressions": [
//       "error",
//       {
//         "allowShortCircuit": true,
//         "allowTernary": true,
//         "allowTaggedTemplates": true,
//       },
//     ],
//     "no-unused-labels": "warn",
//     "no-useless-computed-key": "warn",
//     "no-useless-concat": "warn",
//     "no-useless-escape": "warn",
//     "no-useless-rename": [
//       "warn",
//       {
//         "ignoreDestructuring": false,
//         "ignoreImport": false,
//         "ignoreExport": false,
//       },
//     ],
//     "no-with": "warn",
//     "no-whitespace-before-property": "warn",
//     "react-hooks/exhaustive-deps": "warn",
//     "require-yield": "warn",
//     "rest-spread-spacing": ["warn", "never"],
//     "strict": ["warn", "never"],
//     "unicode-bom": ["warn", "never"],
//     "use-isnan": "warn",
//     "valid-typeof": "warn",
//     "no-restricted-properties": [
//       "error",
//       {
//         "object": "require",
//         "property": "ensure",
//         "message":
//           "Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting",
//       },
//       {
//         "object": "System",
//         "property": "import",
//         "message":
//           "Please use import() instead. More info: https://facebook.github.io/create-react-app/docs/code-splitting",
//       },
//     ],
//     "getter-return": "warn",

//     /**
//      * Import rule configurations
//      * https://github.com/benmosher/eslint-plugin-import
//      */
//     "import/first": "error",
//     "import/no-amd": "error",
//     "import/no-webpack-loader-syntax": "error",

//     /**
//      * React-specific rule configurations
//      * https://github.com/yannickcr/eslint-plugin-react
//      */
//     "react/forbid-foreign-prop-types": ["warn", { "allowInPropTypes": true }],
//     "react/jsx-no-comment-textnodes": "warn",
//     "react/jsx-no-duplicate-props": "warn",
//     "react/jsx-no-target-blank": "warn",
//     "react/jsx-no-undef": "error",
//     "react/jsx-pascal-case": [
//       "warn",
//       {
//         "allowAllCaps": true,
//         "ignore": [],
//       },
//     ],
//     "react/jsx-uses-react": "warn",
//     "react/jsx-uses-vars": "warn",
//     "react/no-danger-with-children": "warn",
//     "react/no-direct-mutation-state": "warn",
//     "react/no-is-mounted": "warn",
//     "react/no-typos": "error",
//     "react/react-in-jsx-scope": "error",
//     "react/require-render-return": "error",
//     "react/style-prop-object": "warn",

//     /**
//      * JSX Accessibility rule configurations
//      * https://github.com/evcohen/eslint-plugin-jsx-a11y
//      */
//     "jsx-a11y/accessible-emoji": "warn",
//     "jsx-a11y/alt-text": "warn",
//     "jsx-a11y/anchor-has-content": "warn",
//     "jsx-a11y/anchor-is-valid": [
//       "warn",
//       {
//         "aspects": ["noHref", "invalidHref"],
//       },
//     ],
//     "jsx-a11y/aria-activedescendant-has-tabindex": "warn",
//     "jsx-a11y/aria-props": "warn",
//     "jsx-a11y/aria-proptypes": "warn",
//     "jsx-a11y/aria-role": "warn",
//     "jsx-a11y/aria-unsupported-elements": "warn",
//     "jsx-a11y/heading-has-content": "warn",
//     "jsx-a11y/iframe-has-title": "warn",
//     "jsx-a11y/img-redundant-alt": "warn",
//     "jsx-a11y/no-access-key": "warn",
//     "jsx-a11y/no-distracting-elements": "warn",
//     "jsx-a11y/no-redundant-roles": "warn",
//     "jsx-a11y/role-has-required-aria-props": "warn",
//     "jsx-a11y/role-supports-aria-props": "warn",
//     "jsx-a11y/scope": "warn",

//     /**
//      * React Hooks rule configurations
//      * https://github.com/facebook/react/tree/master/packages/eslint-plugin-react-hooks
//      */
//     "react-hooks/rules-of-hooks": "error",

//     /**
//      * TypeScript-specific rule configurations (in addition to @typescript-eslint:recommended)
//      * https://github.com/typescript-eslint/typescript-eslint
//      */

//     // TypeScript"s `noFallthroughCasesInSwitch` option is more robust (#6906)
//     "default-case": "off",
//     // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/291)
//     "no-dupe-class-members": "off",
//     // "tsc" already handles this (https://github.com/typescript-eslint/typescript-eslint/issues/477)
//     "no-undef": "off",

//     // Add TypeScript specific rules (and turn off ESLint equivalents)
//     "@typescript-eslint/consistent-type-assertions": "warn",
//     "no-array-constructor": "off",
//     "@typescript-eslint/no-array-constructor": "warn",
//     "@typescript-eslint/no-namespace": "error",
//     "no-use-before-define": "off",
//     "@typescript-eslint/no-use-before-define": [
//       "warn",
//       {
//         "functions": false,
//         "classes": false,
//         "variables": false,
//         "typedefs": false,
//       },
//     ],
//     "no-unused-vars": "off",
//     "@typescript-eslint/no-unused-vars": [
//       "warn",
//       {
//         "args": "none",
//         "ignoreRestSiblings": true,
//       },
//     ],
//     "no-useless-constructor": "off",
//     "@typescript-eslint/no-useless-constructor": "warn",
//     "@typescript-eslint/explicit-member-accessibility": "off",
//     "@typescript-eslint/explicit-function-return-type": "off"
//   }
// }
