import { Tree, updateJson } from 'nx/src/devkit-exports';

export function updateTsConfigsToJs(
  tree: Tree,
  options: { projectRoot: string }
): void {
  let updateConfigPath: string | null = null;

  const paths = {
    tsConfig: `${options.projectRoot}/tsconfig.json`,
    tsConfigLib: `${options.projectRoot}/tsconfig.lib.json`,
    tsConfigApp: `${options.projectRoot}/tsconfig.app.json`,
  };

  updateJson(tree, paths.tsConfig, (json) => {
    if (json.compilerOptions) {
      json.compilerOptions.allowJs = true;
    } else {
      json.compilerOptions = { allowJs: true };
    }
    return json;
  });

  if (tree.exists(paths.tsConfigLib)) {
    updateConfigPath = paths.tsConfigLib;
  }

  if (tree.exists(paths.tsConfigApp)) {
    updateConfigPath = paths.tsConfigApp;
  }

  if (updateConfigPath) {
    updateJson(tree, updateConfigPath, (json) => {
      json.include = uniq([...(json.include ?? []), 'src/**/*.js']);
      json.exclude = uniq([
        ...(json.exclude ?? []),
        'src/**/*.spec.js',
        'src/**/*.test.js',
      ]);

      return json;
    });
  } else {
    throw new Error(
      `project is missing tsconfig.lib.json or tsconfig.app.json`
    );
  }
}

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;
