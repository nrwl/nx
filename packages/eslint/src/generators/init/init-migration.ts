import {
  addDependenciesToPackageJson,
  GeneratorCallback,
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
import { eslintVersion, nxVersion } from '../../utils/versions';
import {
  addBlockToFlatConfigExport,
  addImportToFlatConfig,
  generateSpreadElement,
  removeCompatExtends,
  removePlugin,
} from '../utils/flat-config/ast-utils';
import { hasEslintPlugin } from '../utils/plugin';
import { ESLINT_CONFIG_FILENAMES } from '../../utils/config-file';

export function migrateConfigToMonorepoStyle(
  projects: ProjectConfiguration[],
  tree: Tree,
  unitTestRunner: string,
  keepExistingVersions?: boolean
): GeneratorCallback {
  const rootEslintConfig = findEslintFile(tree);
  let skipCleanup = false;
  if (
    rootEslintConfig?.match(/\.base\./) &&
    !projects.some((p) => p.root === '.')
  ) {
    // if the migration has been run already, we need to rename the base config
    // and only update the extends paths
    tree.rename(rootEslintConfig, rootEslintConfig.replace('.base.', '.'));
    skipCleanup = true;
  } else {
    if (useFlatConfig(tree)) {
      // we need this for the compat
      addDependenciesToPackageJson(
        tree,
        {},
        {
          '@eslint/js': eslintVersion,
        },
        undefined,
        keepExistingVersions
      );
      tree.write(
        tree.exists('eslint.config.js')
          ? 'eslint.base.config.js'
          : 'eslint.config.js',
        getGlobalFlatEslintConfiguration(unitTestRunner)
      );
    } else {
      const eslintFile = findEslintFile(tree, '.');
      writeJson(
        tree,
        eslintFile ? '.eslintrc.base.json' : '.eslintrc.json',
        getGlobalEsLintConfiguration(unitTestRunner)
      );
    }
  }

  // update extends in all projects' eslint configs
  projects.forEach((project) => {
    let eslintFile: string;

    const lintTarget = findLintTarget(project);
    if (lintTarget) {
      // If target is configured in project.json, read file from target options.
      eslintFile =
        lintTarget.options?.eslintConfig || findEslintFile(tree, project.root);
    } else if (hasEslintPlugin(tree)) {
      // Otherwise, if `@nx/eslint/plugin` is used, match any of the known config files.
      for (const f of ESLINT_CONFIG_FILENAMES) {
        if (tree.exists(joinPathFragments(project.root, f))) {
          eslintFile = f;
          break;
        }
      }
    }

    if (eslintFile) {
      const projectEslintPath = joinPathFragments(project.root, eslintFile);
      if (skipCleanup) {
        const content = tree.read(projectEslintPath, 'utf-8');
        tree.write(
          projectEslintPath,
          content.replace(
            rootEslintConfig,
            rootEslintConfig.replace('.base.', '.')
          )
        );
      } else {
        migrateEslintFile(projectEslintPath, tree);
      }
    }
  });

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/eslint-plugin': nxVersion,
    }
  );
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
  const baseFile = findEslintFile(tree);
  if (isEslintConfigSupported(tree)) {
    if (useFlatConfig(tree)) {
      let config = tree.read(projectEslintPath, 'utf-8');
      // remove @nx plugin
      config = removePlugin(config, '@nx', '@nx/eslint-plugin-nx');
      // extend eslint.base.config.js
      config = addImportToFlatConfig(
        config,
        'baseConfig',
        `${offsetFromRoot(dirname(projectEslintPath))}${baseFile}`
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

        // ensure extends is an array
        if (typeof json.extends === 'string') {
          json.extends = [json.extends];
        }

        const pathToRootConfig = `${offsetFromRoot(
          dirname(projectEslintPath)
        )}${baseFile}`;
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
