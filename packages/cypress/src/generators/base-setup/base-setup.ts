import {
  ProjectConfiguration,
  Tree,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readJson,
  readProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';

export interface CypressBaseSetupSchema {
  project: string;
  /**
   * directory from the projectRoot where cypress files will be generated
   * default is `cypress`
   * */
  directory?: string;
  js?: boolean;
  jsx?: boolean;
}

export function addBaseCypressSetup(
  tree: Tree,
  options: CypressBaseSetupSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.project);

  if (
    tree.exists(joinPathFragments(projectConfig.root, 'cypress.config.ts')) ||
    tree.exists(joinPathFragments(projectConfig.root, 'cypress.config.js'))
  ) {
    return;
  }

  const opts = normalizeOptions(tree, projectConfig, options);
  const isUsingTsSolutionConfig = isUsingTsSolutionSetup(tree);
  const templateVars = {
    ...opts,
    jsx: !!opts.jsx,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
    offsetFromProjectRoot: opts.hasTsConfig ? opts.offsetFromProjectRoot : '',
    tsConfigPath:
      // TS solution setup should always extend from tsconfig.base.json to use shared compilerOptions, the project's tsconfig.json will not have compilerOptions.
      isUsingTsSolutionConfig
        ? getRelativePathToRootTsConfig(
            tree,
            opts.hasTsConfig
              ? joinPathFragments(projectConfig.root, options.directory)
              : // If an existing tsconfig.json file does not exist, then cypress tsconfig will be moved to the project root.
                projectConfig.root
          )
        : opts.hasTsConfig
        ? `${opts.offsetFromProjectRoot}tsconfig.json`
        : getRelativePathToRootTsConfig(tree, projectConfig.root),
    linter: isEslintInstalled(tree) ? 'eslint' : 'none',
    ext: '',
  };

  generateFiles(
    tree,
    join(__dirname, 'files/common'),
    projectConfig.root,
    templateVars
  );

  generateFiles(
    tree,
    isUsingTsSolutionConfig
      ? join(__dirname, 'files/tsconfig/ts-solution')
      : join(__dirname, 'files/tsconfig/non-ts-solution'),
    projectConfig.root,
    templateVars
  );

  if (options.js) {
    if (isEsmProject(tree, projectConfig.root)) {
      generateFiles(
        tree,
        join(__dirname, 'files/config-js-esm'),
        projectConfig.root,
        templateVars
      );
    } else {
      generateFiles(
        tree,
        join(__dirname, 'files/config-js-cjs'),
        projectConfig.root,
        templateVars
      );
    }
  } else {
    generateFiles(
      tree,
      join(__dirname, 'files/config-ts'),
      projectConfig.root,
      templateVars
    );
  }

  if (opts.hasTsConfig) {
    updateJson(
      tree,
      joinPathFragments(projectConfig.root, 'tsconfig.json'),
      (json) => {
        // tsconfig doesn't have references so it shouldn't add them
        // like in the case of nextjs apps.
        if (!json.references) {
          return json;
        }

        const tsconfigPath = `./${options.directory}/tsconfig.json`;

        if (!json.references.some((ref) => ref.path === tsconfigPath)) {
          json.references.push({
            path: tsconfigPath,
          });
        }
        return json;
      }
    );
  } else {
    tree.rename(
      joinPathFragments(projectConfig.root, options.directory, 'tsconfig.json'),
      joinPathFragments(projectConfig.root, 'tsconfig.json')
    );
  }
}

function normalizeOptions(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  options: CypressBaseSetupSchema
) {
  options.directory ??= 'cypress';

  const offsetFromProjectRoot = options.directory
    .split('/')
    .map((_) => '..')
    .join('/');

  const hasTsConfig = tree.exists(
    joinPathFragments(projectConfig.root, 'tsconfig.json')
  );

  return {
    ...options,
    projectConfig,
    offsetFromProjectRoot: `${offsetFromProjectRoot}/`,
    hasTsConfig,
  };
}

function isEsmProject(tree: Tree, projectRoot: string) {
  let packageJson: any;
  if (tree.exists(joinPathFragments(projectRoot, 'package.json'))) {
    packageJson = readJson(
      tree,
      joinPathFragments(projectRoot, 'package.json')
    );
  } else {
    packageJson = readJson(tree, 'package.json');
  }
  return packageJson.type === 'module';
}

function isEslintInstalled(tree: Tree): boolean {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!(dependencies?.eslint || devDependencies?.eslint);
}
