import type { Tree } from 'nx/src/generators/tree';
import * as path from 'path';
import type * as Prettier from 'prettier';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { sortObjectByKeys } from 'nx/src/utils/object-sort';
import { requireNx } from '../../nx';

const { updateJson, readJson } = requireNx();

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatFiles(tree: Tree): Promise<void> {
  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
  } catch {}

  sortTsConfig(tree);

  if (!prettier) return;

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );

  await Promise.all(
    Array.from(files).map(async (file) => {
      const systemPath = path.join(tree.root, file.path);

      const resolvedOptions = await prettier.resolveConfig(systemPath, {
        editorconfig: true,
      });

      let optionsFromTree;
      if (!resolvedOptions) {
        try {
          optionsFromTree = readJson(tree, '.prettierrc');
        } catch {}
      }
      const options: any = {
        filepath: systemPath,
        ...(resolvedOptions ?? optionsFromTree),
      };

      if (file.path.endsWith('.swcrc')) {
        options.parser = 'json';
      }

      const support = await prettier.getFileInfo(systemPath, options);
      if (support.ignored || !support.inferredParser) {
        return;
      }

      try {
        tree.write(
          file.path,
          prettier.format(file.content.toString('utf-8'), options)
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
