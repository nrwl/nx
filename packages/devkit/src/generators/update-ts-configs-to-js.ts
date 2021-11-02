import type { Tree } from '@nrwl/tao/src/shared/tree';
import { updateJson } from '../utils/json';

export function updateTsConfigsToJs(
  tree: Tree,
  options: { projectRoot: string }
): void {
  let updateConfigPath: string;

  const paths = {
    tsConfig: `${options.projectRoot}/tsconfig.json`,
    tsConfigLib: `${options.projectRoot}/tsconfig.lib.json`,
    tsConfigApp: `${options.projectRoot}/tsconfig.app.json`,
  };

  const getProjectType = (tree: Tree) => {
    if (tree.exists(paths.tsConfigApp)) {
      return 'application';
    }
    if (tree.exists(paths.tsConfigLib)) {
      return 'library';
    }

    throw new Error(
      `project is missing tsconfig.lib.json or tsconfig.app.json`
    );
  };

  updateJson(tree, paths.tsConfig, (json) => {
    if (json.compilerOptions) {
      json.compilerOptions.allowJs = true;
    } else {
      json.compilerOptions = { allowJs: true };
    }
    return json;
  });

  const projectType = getProjectType(tree);

  if (projectType === 'library') {
    updateConfigPath = paths.tsConfigLib;
  }
  if (projectType === 'application') {
    updateConfigPath = paths.tsConfigApp;
  }

  updateJson(tree, updateConfigPath, (json) => {
    json.include = uniq([...json.include, '**/*.js']);
    json.exclude = uniq([...json.exclude, '**/*.spec.js']);

    return json;
  });
}

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;
