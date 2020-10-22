import { chain, noop, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import type { Linter } from 'eslint';

/**
 * We want to update the JSON in such a way that we:
 * - translate the config to use overrides
 * - don't break existing setups
 *
 * In order to achieve the second point we need to assume
 * that any existing top level rules/plugins etc are intended
 * to be run on all source files.
 */
function updateRootESLintConfig(host: Tree) {
  return host.exists('.eslintrc.json')
    ? updateJsonInTree('.eslintrc.json', (json: Linter.Config) => {
        /**
         * If the user already has overrides specified it is likely they have "forged their own path"
         * when it comes to their ESLint setup, so we do nothing.
         */
        if (Array.isArray(json.overrides)) {
          return json;
        }

        let normalizedExtends: string[] | undefined = undefined;
        if (json.extends) {
          if (typeof json.extends === 'string') {
            normalizedExtends = [json.extends];
          } else if (Array.isArray(json.extends)) {
            normalizedExtends = json.extends;
          }
        }

        json.overrides = [
          /**
           * This configuration is intended to apply to all "source code" (but not
           * markup like HTML, or other custom file types like GraphQL).
           *
           * This is where we will apply any top-level config that the user currently
           * has to ensure that it behaves the same before and after the migration.
           */
          {
            files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
            extends: undefinedIfEmptyArr(
              normalizedExtends
                ? normalizedExtends.filter(
                    (e) => e !== 'plugin:@nrwl/nx/typescript'
                  )
                : normalizedExtends
            ),
            env: json.env,
            settings: json.settings,
            parser: json.parser,
            parserOptions: json.parserOptions,
            plugins: undefinedIfEmptyArr(
              json.plugins.filter((p) => p !== '@nrwl/nx') // remains at top-level, used everywhere
            ),
            rules: json.rules || {},
          },

          /**
           * This configuration is intended to apply to all TypeScript source files.
           * See the eslint-plugin-nx package for what is in the referenced shareable config.
           */
          {
            files: ['*.ts', '*.tsx'],
            extends: ['plugin:@nrwl/nx/typescript'],
            parserOptions: { project: './tsconfig.*?.json' },
            /**
             * Having an empty rules object present makes it more obvious to the user where they would
             * extend things from if they needed to
             */
            rules: {},
          },

          /**
           * This configuration is intended to apply to all JavaScript source files.
           * See the eslint-plugin-nx package for what is in the referenced shareable config.
           */
          {
            files: ['*.js', '*.jsx'],
            extends: ['plugin:@nrwl/nx/javascript'],
            /**
             * Having an empty rules object present makes it more obvious to the user where they would
             * extend things from if they needed to
             */
            rules: {},
          },
        ];

        /**
         * Clean up after copying config to main override
         */
        json.plugins = ['@nrwl/nx'];
        delete json.rules;
        delete json.extends;
        delete json.env;
        delete json.settings;
        delete json.globals;
        delete json.parser;
        delete json.parserOptions;

        return json;
      })
    : noop();
}

function undefinedIfEmptyArr<T>(possibleArr: T): T | undefined {
  if (Array.isArray(possibleArr) && possibleArr.length === 0) {
    return undefined;
  }
  return possibleArr;
}

export default function () {
  return chain([updateRootESLintConfig, formatFiles()]);
}
