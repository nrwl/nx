import {
  ProjectConfiguration,
  Tree,
  writeJson,
  updateProjectConfiguration,
  offsetFromRoot,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { join } from 'path';
import { Linter } from '../utils/linter';
import { lintInitGenerator } from '../init/init';

interface LintProjectOptions {
  project: string;
  linter: Linter;
  eslintFilePatterns?: string[];
  tsConfigPaths?: string[];
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
    rules: {},
  });
}

export function lintProjectGenerator(tree: Tree, options: LintProjectOptions) {
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

  return installTask;
}
