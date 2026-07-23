import { readJson, Tree, writeJson } from 'nx/src/devkit-exports';
import {
  isUsingPrettierInTree,
  sortObjectByKeys,
} from 'nx/src/devkit-internals';
import * as path from 'path';
import type * as Prettier from 'prettier';

// Prettier v3 (ESM) exposes its API as named exports; v2 (CJS) exposes it under
// `.default` when loaded via `import()`. Return whichever carries the API, or
// null if prettier isn't installed.
async function importPrettier(): Promise<typeof Prettier | null> {
  try {
    const imported = await import('prettier');
    return (
      (imported as any).resolveConfig ? imported : (imported as any).default
    ) as typeof Prettier;
  } catch {
    return null;
  }
}

/**
 * Formats all the created or updated files using the configured formatter
 * @param tree - the file system tree
 * @param options - options for the formatFiles function
 *
 * @remarks
 * Set the environment variable `NX_SKIP_FORMAT` to `true` to skip
 * formatting. This is useful for repositories that use alternative formatters
 * or have custom formatting requirements.
 *
 * Note: `NX_SKIP_FORMAT` only skips formatting. TSConfig path sorting
 * (controlled by `sortRootTsconfigPaths` option or `NX_FORMAT_SORT_TSCONFIG_PATHS`)
 * will still occur.
 */
export async function formatFiles(
  tree: Tree,
  options: {
    sortRootTsconfigPaths?: boolean;
  } = {}
): Promise<void> {
  options.sortRootTsconfigPaths ??=
    process.env.NX_FORMAT_SORT_TSCONFIG_PATHS === 'true';

  if (options.sortRootTsconfigPaths) {
    sortTsConfig(tree);
  }

  // Skip formatting if NX_SKIP_FORMAT is set
  // This is checked after tsconfig sorting since sorting is a separate concern
  if (process.env.NX_SKIP_FORMAT === 'true') {
    return;
  }

  let formatterType: 'prettier' | 'oxfmt' | null = null;
  let detectFormatterInTree: ((tree: Tree) => typeof formatterType) | undefined;
  try {
    detectFormatterInTree =
      require('nx/src/devkit-internals').detectFormatterInTree;
  } catch {}

  if (detectFormatterInTree) {
    formatterType = detectFormatterInTree(tree);
  } else {
    // devkit supports nx +/- 1 major, and detectFormatterInTree does not exist
    // in older versions. Missing exports do not throw, so this has to be a
    // presence check rather than a catch - otherwise formatting is silently
    // skipped against an older nx.
    try {
      if ((await importPrettier()) && isUsingPrettierInTree(tree)) {
        formatterType = 'prettier';
      }
    } catch {}
  }

  if (!formatterType) return;

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );

  if (formatterType === 'prettier') {
    await formatWithPrettier(tree, files);
  } else if (formatterType === 'oxfmt') {
    await formatWithOxfmt(tree, files);
  }
}

async function formatWithPrettier(
  tree: Tree,
  files: Set<{ path: string; content: Buffer }>
) {
  const prettier = await importPrettier();
  if (!prettier) {
    return;
  }

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
          await prettier.format(file.content.toString('utf-8'), options)
        );
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

async function formatWithOxfmt(
  tree: Tree,
  files: Set<{ path: string; content: Buffer }>
) {
  // Declared locally rather than via `typeof import('nx/src/devkit-internals')`:
  // devkit type-checks against the published nx, which predates these exports.
  let formatFilesWithOxfmt: (
    files: { path: string; content: string }[],
    workspaceRoot: string,
    seedConfig?: { name: string; content: string }
  ) => Promise<Map<string, string>>;
  let oxfmtConfigFiles: string[];
  try {
    ({ formatFilesWithOxfmt, oxfmtConfigFiles } = require('nx/src/devkit-internals'));
    if (!formatFilesWithOxfmt) return;
  } catch {
    return;
  }

  const staged = Array.from(files).map((file) => ({
    path: file.path,
    content: file.content.toString('utf-8'),
  }));

  try {
    const formatted = await formatFilesWithOxfmt(
      staged,
      tree.root,
      getGeneratedOxfmtConfig(tree, oxfmtConfigFiles)
    );
    for (const [filePath, content] of formatted) {
      tree.write(filePath, content);
    }
  } catch (e) {
    // One message for the batch - a per-file warning would be a wall of noise.
    console.warn(`Could not format files with oxfmt. Error: "${e.message}"`);
  }
}

/**
 * A config the generator just created exists only in the tree, so oxfmt cannot
 * discover it on disk. Hand it over so the files it writes match the config it
 * ships with.
 */
function getGeneratedOxfmtConfig(
  tree: Tree,
  configFiles: string[]
): { name: string; content: string } | undefined {
  const changed = new Set(tree.listChanges().map((change) => change.path));
  for (const name of configFiles ?? []) {
    if (changed.has(name)) {
      return { name, content: tree.read(name, 'utf-8') };
    }
  }
  return undefined;
}

function sortTsConfig(tree: Tree) {
  try {
    const tsConfigPath = getRootTsConfigPath(tree);
    if (!tsConfigPath) {
      return;
    }
    const tsconfig = readJson(tree, tsConfigPath);
    if (!tsconfig.compilerOptions?.paths) {
      return;
    }
    writeJson(tree, tsConfigPath, {
      ...tsconfig,
      compilerOptions: {
        ...tsconfig.compilerOptions,
        paths: sortObjectByKeys(tsconfig.compilerOptions.paths),
      },
    });
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
