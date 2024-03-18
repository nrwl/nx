import {
  ProjectConfiguration,
  Tree,
  generateFiles,
  joinPathFragments,
  offsetFromRoot,
  readProjectConfiguration,
  updateJson,
  readJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';
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
  const templateVars = {
    ...opts,
    jsx: !!opts.jsx,
    offsetFromRoot: offsetFromRoot(projectConfig.root),
    offsetFromProjectRoot: opts.hasTsConfig ? opts.offsetFromProjectRoot : '',
    tsConfigPath: opts.hasTsConfig
      ? `${opts.offsetFromProjectRoot}tsconfig.json`
      : getRelativePathToRootTsConfig(tree, projectConfig.root),
    ext: '',
  };

  generateFiles(
    tree,
    join(__dirname, 'files/common'),
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
