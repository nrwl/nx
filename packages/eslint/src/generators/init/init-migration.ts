import {
  addDependenciesToPackageJson,
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { dirname } from 'path';
import { findEslintFile, isEslintConfigSupported } from '../utils/eslint-file';
import {
  getGlobalEsLintConfiguration,
  getGlobalFlatEslintConfiguration,
} from './global-eslint-config';
import { useFlatConfig } from '../../utils/flat-config';
import { eslintVersion } from '../../utils/versions';
import {
  addBlockToFlatConfigExport,
  addImportToFlatConfig,
  generateSpreadElement,
  removeCompatExtends,
  removePlugin,
} from '../utils/flat-config/ast-utils';

export function migrateConfigToMonorepoStyle(
  projects: ProjectConfiguration[],
  tree: Tree,
  unitTestRunner: string
): void {
  if (useFlatConfig(tree)) {
    // we need this for the compat
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@eslint/js': eslintVersion,
      }
    );
    tree.write(
      'eslint.base.config.js',
      getGlobalFlatEslintConfiguration(unitTestRunner)
    );
  } else {
    writeJson(
      tree,
      '.eslintrc.base.json',
      getGlobalEsLintConfiguration(unitTestRunner)
    );
  }

  // update extens in all projects' eslint configs
  projects.forEach((project) => {
    const lintTarget = findLintTarget(project);
    if (lintTarget) {
      const eslintFile =
        lintTarget.options.eslintConfig || findEslintFile(tree, project.root);
      if (eslintFile) {
        const projectEslintPath = joinPathFragments(project.root, eslintFile);
        migrateEslintFile(projectEslintPath, tree);
      }
    }
  });
}

export function findLintTarget(
  project: ProjectConfiguration
): TargetConfiguration {
  return Object.values(project.targets ?? {}).find(
    (target) =>
      target.executor === '@nx/eslint:lint' ||
      target.executor === '@nx/linter:eslint' ||
      target.executor === '@nrwl/linter:eslint'
  );
}

function migrateEslintFile(projectEslintPath: string, tree: Tree) {
  if (isEslintConfigSupported(tree)) {
    if (useFlatConfig(tree)) {
      let config = tree.read(projectEslintPath, 'utf-8');
      // remove @nx plugin
      config = removePlugin(config, '@nx', '@nx/eslint-plugin-nx');
      // extend eslint.base.config.js
      config = addImportToFlatConfig(
        config,
        'baseConfig',
        `${offsetFromRoot(dirname(projectEslintPath))}eslint.base.config.js`
      );
      config = addBlockToFlatConfigExport(
        config,
        generateSpreadElement('baseConfig'),
        { insertAtTheEnd: false }
      );
      // cleanup file extends
      config = removeCompatExtends(config, [
        'plugin:@nx/typescript',
        'plugin:@nx/javascript',
        'plugin:@nrwl/typescript',
        'plugin:@nrwl/javascript',
      ]);
      tree.write(projectEslintPath, config);
    } else {
      updateJson(tree, projectEslintPath, (json) => {
        // we have a new root now
        delete json.root;
        // remove nrwl/nx plugins
        if (json.plugins) {
          json.plugins = json.plugins.filter(
            (p) => p !== '@nx' && p !== '@nrwl/nx'
          );
          if (json.plugins.length === 0) {
            delete json.plugins;
          }
        }
        // add extends
        json.extends = json.extends || [];
        const pathToRootConfig = `${offsetFromRoot(
          dirname(projectEslintPath)
        )}.eslintrc.base.json`;
        if (json.extends.indexOf(pathToRootConfig) === -1) {
          json.extends.push(pathToRootConfig);
        }
        // cleanup overrides
        if (json.overrides) {
          json.overrides.forEach((override) => {
            if (override.extends) {
              override.extends = override.extends.filter(
                (ext) =>
                  ext !== 'plugin:@nx/typescript' &&
                  ext !== 'plugin:@nrwl/nx/typescript' &&
                  ext !== 'plugin:@nx/javascript' &&
                  ext !== 'plugin:@nrwl/nx/javascript'
              );
              if (override.extends.length === 0) {
                delete override.extends;
              }
            }
          });
        }
        return json;
      });
    }
    return;
  }
  if (
    projectEslintPath.endsWith('.yml') ||
    projectEslintPath.endsWith('.yaml')
  ) {
    console.warn('YAML eslint config is not supported yet for migration');
  }
  if (projectEslintPath.endsWith('.js') || projectEslintPath.endsWith('.cjs')) {
    console.warn('JS eslint config is not supported yet for migration');
  }
}
