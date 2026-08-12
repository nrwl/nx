import * as path from 'path';
import type * as Prettier from 'prettier';
import { normalizePath } from '../../utils/path';
import {
  detectFormatter,
  detectFormatterInTree,
  type FormatterType,
} from '../../utils/formatters';
import { formatFilesWithOxfmt } from '../../utils/formatters/oxfmt';
import type { Tree } from '../tree';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { output } from '../../utils/output';

/**
 * Formats all the created or updated files using the configured formatter
 * @param tree - the file system tree
 *
 * @remarks
 * Set the environment variable `NX_SKIP_FORMAT` to `true` to skip
 * formatting. This is useful for repositories that format with a tool Nx does
 * not drive (Biome, dprint) or that have custom formatting requirements.
 */
export async function formatChangedFiles(
  tree: Tree,
  options?: {
    silent?: boolean;
    /**
     * Tree-relative paths to leave untouched. Both platform-native and
     * forward-slash separators are accepted.
     */
    excludePaths?: Set<string>;
  }
): Promise<void> {
  if (process.env.NX_SKIP_FORMAT === 'true') {
    return;
  }

  const excludedPaths = options?.excludePaths
    ? new Set(Array.from(options.excludePaths, normalizePath))
    : undefined;
  const files = new Set(
    tree
      .listChanges()
      .filter(
        (file) =>
          file.type !== 'DELETE' &&
          !excludedPaths?.has(normalizePath(file.path))
      )
  );

  // Detect from the tree, not disk: the tree is the source of truth and may
  // hold a config the generator just created but hasn't flushed. Probing disk
  // would also read the real workspace config in tests.
  //
  // No `seedConfig` is threaded through, unlike devkit's `formatFiles`:
  // `formatFilesWithOxfmt` falls back to a JSON config carried in the batch.
  const formatterType = detectFormatterInTree(tree);
  if (!formatterType) {
    return;
  }

  const results = await formatDetectedFiles(
    formatterType,
    Array.from(files),
    tree.root,
    options
  );

  for (const [path, content] of results) {
    tree.write(path, content);
  }
}

export async function formatFileContents(
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: {
    silent?: boolean;
  }
): Promise<Map<string, string>> {
  // Check here as well for direct callers of this function
  if (process.env.NX_SKIP_FORMAT === 'true' || files.length === 0) {
    return new Map<string, string>();
  }

  // Direct callers have no tree, so detection falls back to disk.
  const formatterType = detectFormatter(root);
  if (!formatterType) {
    return new Map<string, string>();
  }

  return formatDetectedFiles(formatterType, files, root, options);
}

function formatDetectedFiles(
  formatterType: FormatterType,
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: { silent?: boolean }
): Promise<Map<string, string>> {
  switch (formatterType) {
    case 'prettier':
      return formatFilesWithPrettier(files, root, options);
    case 'oxfmt':
      return runOxfmtBatch(files, root, options);
    default: {
      // Without this arm an unhandled formatter returns undefined into
      // callers that iterate it.
      const unhandled: never = formatterType;
      throw new Error(`Unhandled formatter: ${unhandled}`);
    }
  }
}

async function formatFilesWithPrettier(
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: { silent?: boolean }
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  let prettier: typeof Prettier;
  try {
    const prettierPath = require.resolve('prettier', {
      paths: [...getNxRequirePaths(root), __dirname],
    });
    prettier = require(prettierPath);
  } catch {}

  if (!prettier) {
    // Detection said prettier, so this is "configured but not installed" -
    // the oxfmt path reports it, and silence here just leaves files
    // unformatted with no reason given.
    if (!options?.silent) {
      output.warn({
        title:
          'prettier is configured for this workspace but is not installed.',
        bodyLines: ['Install "prettier" to format generated files.'],
      });
    }
    return results;
  }

  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const systemPath = path.join(root, file.path);
        let resolvedOptions: any = {
          filepath: systemPath,
        };

        const config = await prettier.resolveConfig(systemPath, {
          editorconfig: true,
        });
        if (!config) {
          return;
        }
        resolvedOptions = {
          ...resolvedOptions,
          ...config,
        };

        const support = await prettier.getFileInfo(systemPath, resolvedOptions);
        if (support.ignored || !support.inferredParser) {
          return;
        }

        results.set(
          file.path,
          await prettier.format(file.content.toString('utf-8'), resolvedOptions)
        );
      } catch (e) {
        if (!options?.silent) {
          output.warn({
            title: `Could not format ${file.path}`,
            bodyLines: [e.message],
          });
        }
      }
    })
  );

  return results;
}

async function runOxfmtBatch(
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: { silent?: boolean }
): Promise<Map<string, string>> {
  try {
    // The whole batch goes through one call: oxfmt's ESM API is loaded once and
    // each file is formatted in memory, so no process is spawned per file and a
    // file oxfmt cannot parse costs only itself.
    const { formatted, errors } = await formatFilesWithOxfmt(
      files.map((file) => ({
        path: file.path,
        content: file.content.toString('utf-8'),
      })),
      root
    );
    if (errors?.length && !options?.silent) {
      output.warn({
        title: 'Could not format some files with oxfmt',
        bodyLines: errors,
      });
    }
    return formatted;
  } catch (e) {
    if (!options?.silent) {
      output.warn({
        title: 'Could not format files with oxfmt',
        bodyLines: [e.message],
      });
    }
    return new Map<string, string>();
  }
}
