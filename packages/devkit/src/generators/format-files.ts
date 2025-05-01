import * as path from 'path';
import type * as Prettier from 'prettier';

import { readJson, Tree, updateJson } from 'nx/src/devkit-exports';
import {
  sortObjectByKeys,
  isUsingPrettierInTree,
} from 'nx/src/devkit-internals';

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatFiles(
  tree: Tree,
  options = {
    /**
     * TODO(v21): Stop sorting tsconfig paths by default, paths are now less common/important
     * in Nx workspace setups, and the sorting causes comments to be lost.
     */
    sortRootTsconfigPaths: true,
  }
): Promise<void> {
  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
    /**
     * Even after we discovered prettier in node_modules, we need to be sure that the user is intentionally using prettier
     * before proceeding to format with it.
     */
    if (!isUsingPrettierInTree(tree)) {
      return;
    }
  } catch {}

  if (options.sortRootTsconfigPaths) {
    sortTsConfig(tree);
  }

  if (!prettier) return;

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );

  const changedPrettierInTree = getChangedPrettierConfigInTree(tree);

  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const systemPath = path.join(tree.root, file.path);

        const resolvedOptions = await prettier.resolveConfig(systemPath, {
          editorconfig: true,
        });

        const options: Prettier.Options = {
          ...resolvedOptions,
          ...changedPrettierInTree,
          filepath: systemPath,
        };

        if (file.path.endsWith('.swcrc')) {
          options.parser = 'json';
        }

        const support = await prettier.getFileInfo(systemPath, options as any);
        if (support.ignored || !support.inferredParser) {
          return;
        }

        tree.write(
          file.path,
          // In prettier v3 the format result is a promise
          await (prettier.format(file.content.toString('utf-8'), options) as
            | Promise<string>
            | string)
        );
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

function sortTsConfig(tree: Tree) {
  try {
    const tsConfigPath = getRootTsConfigPath(tree);
    if (!tsConfigPath) {
      return;
    }
    updateJson(tree, tsConfigPath, (tsconfig) => ({
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        paths: sortObjectByKeys(tsconfig.compilerOptions.paths),
      },
    }));
  } catch (e) {
    // catch noop
  }
}

function getRootTsConfigPath(tree: Tree): string | null {
  for (const path of ['tsconfig.base.json', 'tsconfig.json']) {
    if (tree.exists(path)) {
      return path;
    }
  }

  return null;
}

function getChangedPrettierConfigInTree(tree: Tree): Prettier.Options | null {
  if (tree.listChanges().find((file) => file.path === '.prettierrc')) {
    try {
      return readJson(tree, '.prettierrc');
    } catch {
      return null;
    }
  } else {
    return null;
  }
}
