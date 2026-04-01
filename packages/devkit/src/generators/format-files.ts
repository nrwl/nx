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
  try {
    const { detectFormatterInTree } = require('nx/src/devkit-internals');
    if (detectFormatterInTree) {
      formatterType = detectFormatterInTree(tree);
    }
  } catch {
    // Fallback for older nx versions: check prettier directly
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
  let formatContentWithOxfmt: typeof import('nx/src/devkit-internals').formatContentWithOxfmt;
  try {
    formatContentWithOxfmt =
      require('nx/src/devkit-internals').formatContentWithOxfmt;
    if (!formatContentWithOxfmt) return;
  } catch {
    return;
  }

  // If the oxfmt config exists in the virtual tree but not on disk,
  // write it to a temp file so the oxfmt binary can pick it up.
  const configPath = getOxfmtConfigPathFromTree(tree);

  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const formatted = await formatContentWithOxfmt(
          path.join(tree.root, file.path),
          file.content.toString('utf-8'),
          configPath
        );
        tree.write(file.path, formatted);
      } catch (e) {
        console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
      }
    })
  );
}

function getOxfmtConfigPathFromTree(tree: Tree): string | undefined {
  const oxfmtConfigFiles = [
    '.oxfmtrc.json',
    '.oxfmtrc.jsonc',
    'oxfmt.config.js',
    'oxfmt.config.cjs',
    'oxfmt.config.mjs',
    'oxfmt.config.ts',
    'oxfmt.config.mts',
    'oxfmt.config.cts',
  ];

  // Check if a config file was changed in the tree (i.e., newly generated)
  const changedFiles = new Set(tree.listChanges().map((change) => change.path));
  for (const configFile of oxfmtConfigFiles) {
    if (changedFiles.has(configFile)) {
      // The config is in the virtual tree — write it to a temp file
      // so the oxfmt binary can read it
      const fs = require('fs');
      const os = require('os');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oxfmt-'));
      const tmpConfigPath = path.join(tmpDir, configFile);
      fs.writeFileSync(tmpConfigPath, tree.read(configFile));
      return tmpConfigPath;
    }
  }

  // Check if a config already exists on disk
  for (const configFile of oxfmtConfigFiles) {
    const diskPath = path.join(tree.root, configFile);
    if (require('fs').existsSync(diskPath)) {
      return diskPath;
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
