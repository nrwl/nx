import { readJson, Tree, writeJson } from 'nx/src/devkit-exports';
import type { FormatterType, TreeIgnoreChecker } from 'nx/src/devkit-internals';
import {
  createOxfmtIgnoreChecker,
  createPrettierIgnoreChecker,
  detectFormatterInTree,
  formatFilesWithOxfmt,
  isUsingPrettierInTree,
  oxfmtConfigFiles,
  sortObjectByKeys,
} from 'nx/src/devkit-internals';
import * as path from 'path';
import type * as Prettier from 'prettier';
import { NOTHING_IGNORED } from '../utils/nx-ignore-internals';

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
 * Formats the created or updated files with the configured formatter,
 * skipping `node_modules`, `.git`, the nx and yarn caches, and whatever the
 * workspace's ignore files cover. Which ignore files apply follows the
 * formatter: prettier reads the workspace root only, oxfmt cascades.
 * @param tree - the file system tree
 * @param options - options for the formatFiles function
 *
 * @remarks
 * `NX_SKIP_FORMAT=true` skips formatting - but not TSConfig path sorting,
 * which is controlled by `sortRootTsconfigPaths` or
 * `NX_FORMAT_SORT_TSCONFIG_PATHS`.
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

  let formatterType: FormatterType | null = null;
  // devkit supports nx +/- 1 major and these exports do not exist in older
  // versions. A missing CommonJS named export is `undefined` rather than a
  // throw, so a presence check is what handles it - not a try/catch.
  if (detectFormatterInTree) {
    formatterType = detectFormatterInTree(tree);
  } else {
    try {
      if ((await importPrettier()) && isUsingPrettierInTree(tree)) {
        formatterType = 'prettier';
      }
    } catch {}
  }

  if (!formatterType) return;

  // Each formatter gets the ignore rules its own CLI applies, so a generator
  // does not rewrite a file that formatter would skip. Both measured against
  // the real CLIs. `.nxignore` is the exception in both directions: `format.ts`
  // filters its own list through it, and neither checker reads it.
  //
  // `getFileInfo` below looks like it filters ignored files but with no
  // `ignorePath` it only covers its built-in `node_modules` skip (measured).
  // The optional call is the older-nx path - see `NOTHING_IGNORED`.
  const changedFiles = (
    createChecker: ((tree: Tree) => TreeIgnoreChecker) | undefined
  ) => {
    const { isIgnoredFile } = createChecker?.(tree) ?? NOTHING_IGNORED;
    return new Set(
      tree
        .listChanges()
        .filter((file) => file.type !== 'DELETE' && !isIgnoredFile(file.path))
    );
  };

  // One switch rather than a checker ternary plus a dispatch `if`: those defaulted
  // differently, so a third formatter would have been filtered with prettier's
  // rules and then not formatted at all.
  switch (formatterType) {
    case 'prettier':
      await formatWithPrettier(tree, changedFiles(createPrettierIgnoreChecker));
      break;
    case 'oxfmt':
      await formatWithOxfmt(tree, changedFiles(createOxfmtIgnoreChecker));
      break;
    default: {
      const unhandled: never = formatterType;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}

async function formatWithPrettier(
  tree: Tree,
  files: Set<{ path: string; content: Buffer }>
) {
  const prettier = await importPrettier();
  if (!prettier) {
    // Detection said this workspace formats with prettier, so silence here
    // would leave a generator's files unformatted for no stated reason.
    console.warn(
      'Could not format files with prettier: prettier is configured for this workspace but is not installed.'
    );
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
  if (!formatFilesWithOxfmt) return;

  const staged = Array.from(files).map((file) => ({
    path: file.path,
    content: file.content.toString('utf-8'),
  }));

  try {
    const { formatted, errors } = await formatFilesWithOxfmt(
      staged,
      tree.root,
      getGeneratedOxfmtConfig(oxfmtConfigFiles, files)
    );
    for (const [filePath, content] of formatted) {
      tree.write(filePath, content);
    }
    if (errors?.length) {
      // One warning for the batch, but every failing file is named - oxfmt's
      // `message` alone ("Unexpected token") says nothing about which file.
      console.warn(
        [`Could not format some files with oxfmt:`, ...errors].join('\n  ')
      );
    }
  } catch (e) {
    console.warn(`Could not format files with oxfmt. Error: "${e.message}"`);
  }
}

/**
 * A config the generator just created exists only in the tree, so oxfmt cannot
 * discover it on disk. Hand it over so the files it writes match the config it
 * ships with.
 */
function getGeneratedOxfmtConfig(
  // `readonly` because this only iterates: nx's `oxfmtConfigFiles` is a plain
  // array today, and marking it `as const` there should not break devkit here.
  configFiles: readonly string[] | undefined,
  // The caller's already-filtered set, rather than a second `listChanges()`:
  // that walk stats every recorded change, and deletions are excluded from it
  // for us. A deleted config is not one the generator "just created", and
  // treating it as one would report an unreadable config and skip the batch.
  files: Set<{ path: string; content: Buffer }>
): { name: string; content: string } | undefined {
  // Keyed by path so the content comes from that same set. Re-reading through
  // `tree.read` would reintroduce a `string | null` the filtering already
  // rules out.
  const changed = new Map(
    Array.from(files, (file) => [file.path, file.content] as const)
  );
  for (const name of configFiles ?? []) {
    const content = changed.get(name);
    if (content !== undefined) {
      return { name, content: content.toString('utf-8') };
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
