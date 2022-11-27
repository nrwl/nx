import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';
import { basename, dirname } from 'path';
import { findEslintFile } from '../utils/eslint-file';
import { getGlobalEsLintConfiguration } from './global-eslint-config';

const FILE_EXTENSION_REGEX = /(?<!(^|\/))(\.[^/.]+)$/;

export function migrateConfigToMonorepoStyle(
  projects: ProjectConfiguration[],
  tree: Tree,
  unitTestRunner: string
): void {
  // copy the root's .eslintrc.json to new name
  const rootProject = projects.find((p) => p.root === '.');
  const eslintPath =
    rootProject.targets?.lint?.options?.eslintConfig || findEslintFile(tree);
  const pathSegments = eslintPath.split(FILE_EXTENSION_REGEX).filter(Boolean);
  const rootProjEslintPath =
    pathSegments.length > 1
      ? pathSegments.join(`.${rootProject.name}`)
      : `.${rootProject.name}.${rootProject.name}`;
  tree.write(rootProjEslintPath, tree.read(eslintPath));

  // update root project's configuration
  const lintTarget = findLintTarget(rootProject);
  lintTarget.options.eslintConfig = rootProjEslintPath;
  updateProjectConfiguration(tree, rootProject.name, rootProject);

  // replace root eslint with default global
  tree.delete(eslintPath);
  writeJson(
    tree,
    '.eslintrc.json',
    getGlobalEsLintConfiguration(unitTestRunner)
  );

  // update extens in all projects' eslint configs
  projects.forEach((project) => {
    const lintTarget = findLintTarget(project);
    if (lintTarget) {
      const projectEslintPath = joinPathFragments(
        project.root,
        lintTarget.options.eslintConfig || findEslintFile(tree, project.root)
      );
      migrateEslintFile(projectEslintPath, tree);
    }
  });
}

export function findLintTarget(
  project: ProjectConfiguration
): TargetConfiguration {
  return Object.entries(project.targets).find(
    ([name, target]) =>
      name === 'lint' || target.executor === '@nrwl/linter:eslint'
  )?.[1];
}

function migrateEslintFile(projectEslintPath: string, tree: Tree) {
  if (
    projectEslintPath.endsWith('.json') ||
    projectEslintPath.endsWith('.eslintrc')
  ) {
    updateJson(tree, projectEslintPath, (json) => {
      // we have a new root now
      delete json.root;
      // remove nrwl/nx plugins
      if (json.plugins) {
        json.plugins = json.plugins.filter((p) => p !== '@nrwl/nx');
        if (json.plugins.length === 0) {
          delete json.plugins;
        }
      }
      // add extends
      json.extends = json.extends || [];
      const pathToRootConfig = `${offsetFromRoot(
        dirname(projectEslintPath)
      )}.eslintrc.json`;
      if (json.extends.indexOf(pathToRootConfig) === -1) {
        json.extends.push(pathToRootConfig);
      }
      // cleanup overrides
      if (json.overrides) {
        json.overrides.forEach((override) => {
          if (override.extends) {
            override.extends = override.extends.filter(
              (ext) =>
                ext !== 'plugin:@nrwl/nx/typescript' &&
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
    return;
  }
  if (
    projectEslintPath.endsWith('.yml') ||
    projectEslintPath.endsWith('.yaml')
  ) {
    console.warn('YAML eslint config is not supported yet for migration');
  }
  if (projectEslintPath.endsWith('.js') || projectEslintPath.endsWith('.cjs')) {
    console.warn('YAML eslint config is not supported yet for migration');
  }
}
