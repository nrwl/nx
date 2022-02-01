import {
  writeJson,
  updateProjectConfiguration,
  offsetFromRoot,
  readProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';
import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import { join } from 'path';
import { Linter } from '../utils/linter';
import { lintInitGenerator } from '../init/init';

interface LintProjectOptions {
  project: string;
  linter?: Linter;
  eslintFilePatterns?: string[];
  tsConfigPaths?: string[];
  skipFormat: boolean;
  setParserOptionsProject?: boolean;
  skipPackageJson?: boolean;
}

function createTsLintConfiguration(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  writeJson(tree, join(projectConfig.root, `tslint.json`), {
    extends: `${offsetFromRoot(projectConfig.root)}tslint.json`,
    // Include project files to be linted since the global one excludes all files.
    linterOptions: {
      exclude: ['!**/*'],
    },
    rules: {},
  });
}

function createEsLintConfiguration(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  setParserOptionsProject: boolean
) {
  writeJson(tree, join(projectConfig.root, `.eslintrc.json`), {
    extends: [`${offsetFromRoot(projectConfig.root)}.eslintrc.json`],
    // Include project files to be linted since the global one excludes all files.
    ignorePatterns: ['!**/*'],
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
        parserOptions: !setParserOptionsProject
          ? undefined
          : {
              project: [`${projectConfig.root}/tsconfig.*?.json`],
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
  });
}

export async function lintProjectGenerator(
  tree: Tree,
  options: LintProjectOptions
) {
  const installTask = lintInitGenerator(tree, {
    linter: options.linter,
    skipPackageJson: options.skipPackageJson,
  });
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (options.linter === Linter.EsLint) {
    projectConfig.targets['lint'] = {
      executor: '@nrwl/linter:eslint',
      outputs: ['{options.outputFile}'],
      options: {
        lintFilePatterns: options.eslintFilePatterns,
      },
    };
    createEsLintConfiguration(
      tree,
      projectConfig,
      options.setParserOptionsProject
    );
  } else {
    projectConfig.targets['lint'] = {
      executor: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: options.tsConfigPaths,
        exclude: ['**/node_modules/**', `!${projectConfig.root}/**/*`],
      },
    };
    createTsLintConfiguration(tree, projectConfig);
  }

  updateProjectConfiguration(tree, options.project, projectConfig);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return installTask;
}
