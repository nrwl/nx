import { join } from '@angular-devkit/core';
import {
  chain,
  Rule,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import { addDepsToPackageJson } from './ast-utils';
import { offsetFromRoot } from './common';
import {
  eslintVersion,
  typescriptESLintVersion,
  eslintConfigPrettierVersion,
  nxVersion,
} from './versions';

export const enum Linter {
  TsLint = 'tslint',
  EsLint = 'eslint',
  None = 'none',
}

export function generateProjectLint(
  projectRoot: string,
  tsConfigPath: string,
  linter: Linter
) {
  if (linter === Linter.TsLint) {
    return {
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: [tsConfigPath],
        exclude: ['**/node_modules/**', '!' + projectRoot + '/**/*'],
      },
    };
  } else if (linter === Linter.EsLint) {
    return {
      builder: '@nrwl/linter:lint',
      options: {
        // No config option here because eslint resolve them automatically.
        // By not specifying a config option we allow eslint to support
        // nested configurations.
        linter: 'eslint',
        tsConfig: [tsConfigPath],
        exclude: ['**/node_modules/**', '!' + projectRoot + '/**/*'],
      },
    };
  } else {
    return undefined;
  }
}

interface AddLintFileOptions {
  onlyGlobal?: boolean;
  localConfig?: any;
  extraPackageDeps?: {
    dependencies: { [key: string]: string };
    devDependencies: { [key: string]: string };
  };
}
export function addLintFiles(
  projectRoot: string,
  linter: Linter,
  options: AddLintFileOptions = {}
): Rule {
  return (host: Tree, context: SchematicContext) => {
    if (options.onlyGlobal && options.localConfig) {
      throw new Error(
        'onlyGlobal and localConfig cannot be used at the same time'
      );
    }

    const chainedCommands = [];

    if (linter === 'tslint') {
      chainedCommands.push((host: Tree) => {
        if (!host.exists('/tslint.json')) {
          host.create('/tslint.json', globalTsLint);
        }
        if (!options.onlyGlobal) {
          host.create(
            join(projectRoot as any, `tslint.json`),
            JSON.stringify({
              extends: `${offsetFromRoot(projectRoot)}tslint.json`,
              // Include project files to be linted since the global one excludes all files.
              linterOptions: {
                exclude: ['!**/*'],
              },
              rules: {},
            })
          );
        }
      });

      return chain(chainedCommands);
    }

    if (linter === 'eslint') {
      if (!host.exists('/.eslintrc')) {
        chainedCommands.push((host: Tree) => {
          host.create('/.eslintrc', globalESLint);

          return addDepsToPackageJson(
            {
              ...(options.extraPackageDeps
                ? options.extraPackageDeps.dependencies
                : {}),
            },
            {
              '@nrwl/eslint-plugin-nx': nxVersion,
              '@typescript-eslint/parser': typescriptESLintVersion,
              '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
              eslint: eslintVersion,
              'eslint-config-prettier': eslintConfigPrettierVersion,
              ...(options.extraPackageDeps
                ? options.extraPackageDeps.devDependencies
                : {}),
            }
          );
        });
      }

      if (!options.onlyGlobal) {
        chainedCommands.push((host: Tree) => {
          let configJson;
          const rootConfig = `${offsetFromRoot(projectRoot)}.eslintrc`;
          if (options.localConfig) {
            const extendsOption = options.localConfig.extends
              ? Array.isArray(options.localConfig.extends)
                ? options.localConfig.extends
                : [options.localConfig.extends]
              : [];
            configJson = {
              rules: {},
              ...options.localConfig,
              extends: [...extendsOption, rootConfig],
            };
          } else {
            configJson = {
              extends: rootConfig,
              rules: {},
            };
          }
          // Include all project files to be linted (since they are turned off in the root eslintrc file).
          configJson.ignorePatterns = ['!**/*'];
          host.create(
            join(projectRoot as any, `.eslintrc`),
            JSON.stringify(configJson)
          );
        });
      }

      return chain(chainedCommands);
    }
  };
}

const globalTsLint = `
{
  "rulesDirectory": ["node_modules/@nrwl/workspace/src/tslint"],
  "linterOptions": {
    "exclude": ["**/*"]
  },
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
        "enforceBuildableLibDependency": true,
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
    "project": "./tsconfig.*?.json"
  },
  "ignorePatterns": ["**/*"],
  "plugins": ["@typescript-eslint", "@nrwl/nx"],
  "extends": [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  "rules": {
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@nrwl/nx/enforce-module-boundaries": [
      "error",
      {
        "enforceBuildableLibDependency": true,
        "allow": [],
        "depConstraints": [
          { "sourceTag": "*", "onlyDependOnLibsWithTags": ["*"] }
        ]
      }
    ]
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
