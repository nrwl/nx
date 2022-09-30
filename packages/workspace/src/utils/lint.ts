import { join } from '@angular-devkit/core';
import {
  chain,
  Rule,
  Tree,
  SchematicContext,
} from '@angular-devkit/schematics';
import { addDepsToPackageJson } from './ast-utils';
import {
  eslintVersion,
  typescriptESLintVersion,
  eslintConfigPrettierVersion,
  nxVersion,
} from './versions';
import { offsetFromRoot } from '@nrwl/devkit';

export const enum Linter {
  EsLint = 'eslint',
  None = 'none',
}

export function generateProjectLint(
  projectRoot: string,
  tsConfigPath: string,
  linter: Linter,
  eslintFilePatterns: string[]
) {
  if (linter === Linter.EsLint) {
    return {
      builder: '@nrwl/linter:eslint',
      options: {
        lintFilePatterns: eslintFilePatterns,
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
  setParserOptionsProject?: boolean;
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

    if (linter === 'eslint') {
      if (!host.exists('/.eslintrc.json')) {
        host.create('/.eslintrc.json', globalESLint);
      }
      chainedCommands.push(
        addDepsToPackageJson(
          {
            ...(options.extraPackageDeps
              ? options.extraPackageDeps.dependencies
              : {}),
          },
          {
            '@nrwl/linter': nxVersion,
            '@nrwl/eslint-plugin-nx': nxVersion,
            '@typescript-eslint/parser': typescriptESLintVersion,
            '@typescript-eslint/eslint-plugin': typescriptESLintVersion,
            eslint: eslintVersion,
            'eslint-config-prettier': eslintConfigPrettierVersion,
            ...(options.extraPackageDeps?.devDependencies ?? {}),
          }
        )
      );

      if (!options.onlyGlobal) {
        chainedCommands.push((host: Tree) => {
          let configJson;
          const rootConfig = `${offsetFromRoot(projectRoot)}.eslintrc.json`;

          // Include all project files to be linted (since they are turned off in the root eslintrc file).
          const ignorePatterns = ['!**/*'];

          if (options.localConfig) {
            /**
             * The end config is much easier to reason about if "extends" comes first,
             * so as well as applying the extension from the root lint config, we also
             * adjust the config to make extends come first.
             */
            const { extends: extendsVal, ...localConfigExceptExtends } =
              options.localConfig;

            const extendsOption = extendsVal
              ? Array.isArray(extendsVal)
                ? extendsVal
                : [extendsVal]
              : [];

            configJson = {
              extends: [...extendsOption, rootConfig],
              ignorePatterns,
              ...localConfigExceptExtends,
            };
          } else {
            configJson = {
              extends: rootConfig,
              ignorePatterns,
              overrides: [
                {
                  files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
                  /**
                   * NOTE: We no longer set parserOptions.project by default when creating new projects.
                   *
                   * We have observed that users rarely add rules requiring type-checking to their Nx workspaces, and therefore
                   * do not actually need the capabilites which parserOptions.project provides. When specifying parserOptions.project,
                   * typescript-eslint needs to create full TypeScript Programs for you. When omitting it, it can perform a simple
                   * parse (and AST tranformation) of the source files it encounters during a lint run, which is much faster and much
                   * less memory intensive.
                   *
                   * In the rare case that users attempt to add rules requiring type-checking to their setup later on (and haven't set
                   * parserOptions.project), the executor will attempt to look for the particular error typescript-eslint gives you
                   * and provide feedback to the user.
                   */
                  parserOptions: !options.setParserOptionsProject
                    ? undefined
                    : {
                        project: [`${projectRoot}/tsconfig.*?.json`],
                      },
                  /**
                   * Having an empty rules object present makes it more obvious to the user where they would
                   * extend things from if they needed to
                   */
                  rules: {},
                },
                {
                  files: ['*.ts', '*.tsx'],
                  rules: {},
                },
                {
                  files: ['*.js', '*.jsx'],
                  rules: {},
                },
              ],
            };
          }

          host.create(
            join(projectRoot as any, `.eslintrc.json`),
            JSON.stringify(configJson)
          );
        });
      }

      return chain(chainedCommands);
    }
  };
}

const globalESLint = JSON.stringify({
  root: true,
  ignorePatterns: ['**/*'],
  plugins: ['@nrwl/nx'],
  /**
   * We leverage ESLint's "overrides" capability so that we can set up a root config which will support
   * all permutations of Nx workspaces across all frameworks, libraries and tools.
   *
   * The key point is that we need entirely different ESLint config to apply to different types of files,
   * but we still want to share common config where possible.
   */
  overrides: [
    /**
     * This configuration is intended to apply to all "source code" (but not
     * markup like HTML, or other custom file types like GraphQL)
     */
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
      rules: {
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
    },

    /**
     * This configuration is intended to apply to all TypeScript source files.
     * See the eslint-plugin-nx package for what is in the referenced shareable config.
     */
    {
      files: ['*.ts', '*.tsx'],
      extends: ['plugin:@nrwl/nx/typescript'],
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
  ],
});
