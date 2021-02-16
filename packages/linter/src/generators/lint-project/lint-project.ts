import {
  ProjectConfiguration,
  Tree,
  writeJson,
  updateProjectConfiguration,
  offsetFromRoot,
  readProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';
import { join } from 'path';
import { Linter } from '../utils/linter';
import { lintInitGenerator } from '../init/init';

interface LintProjectOptions {
  project: string;
  linter?: Linter;
  eslintFilePatterns?: string[];
  tsConfigPaths?: string[];
  skipFormat: boolean;
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
  projectConfig: ProjectConfiguration
) {
  writeJson(tree, join(projectConfig.root, `.eslintrc.json`), {
    extends: [`${offsetFromRoot(projectConfig.root)}.eslintrc.json`],
    // Include project files to be linted since the global one excludes all files.
    ignorePatterns: ['!**/*'],
    overrides: [
      {
        files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
        parserOptions: {
          /**
           * In order to ensure maximum efficiency when typescript-eslint generates TypeScript Programs
           * behind the scenes during lint runs, we need to make sure the project is configured to use its
           * own specific tsconfigs, and not fall back to the ones in the root of the workspace.
           */
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
  });
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (options.linter === Linter.EsLint) {
    projectConfig.targets['lint'] = {
      executor: '@nrwl/linter:eslint',
      options: {
        lintFilePatterns: options.eslintFilePatterns,
      },
    };
    createEsLintConfiguration(tree, projectConfig);
  } else {
    projectConfig.targets['lint'] = {
      executor: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: options.tsConfigPaths,
        exclude: ['**/node_modules/**', '!' + projectConfig.root + '/**/*'],
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
