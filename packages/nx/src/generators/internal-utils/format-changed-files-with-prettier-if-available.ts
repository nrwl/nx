import * as path from 'path';
import type * as Prettier from 'prettier';
import { detectFormatter } from '../../utils/formatters';
import { formatFilesWithOxfmt as batchFormatWithOxfmt } from '../../utils/formatters/oxfmt';
import type { Tree } from '../tree';
import { getNxRequirePaths } from '../../utils/installation-directory';

/**
 * Formats all the created or updated files using the configured formatter
 * @param tree - the file system tree
 *
 * @remarks
 * Set the environment variable `NX_SKIP_FORMAT` to `true` to skip
 * formatting. This is useful for repositories that have custom formatting
 * requirements.
 */
export async function formatChangedFilesWithPrettierIfAvailable(
  tree: Tree,
  options?: {
    silent?: boolean;
  }
): Promise<void> {
  if (process.env.NX_SKIP_FORMAT === 'true') {
    return;
  }

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );

  const results = await formatFilesWithPrettierIfAvailable(
    Array.from(files),
    tree.root,
    options
  );

  for (const [path, content] of results) {
    tree.write(path, content);
  }
}

export async function formatFilesWithPrettierIfAvailable(
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: {
    silent?: boolean;
  }
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  // Check here as well for direct callers of this function
  if (process.env.NX_SKIP_FORMAT === 'true') {
    return results;
  }

  const formatterType = detectFormatter(root);
  if (!formatterType) {
    return results;
  }

  if (formatterType === 'prettier') {
    return formatFilesWithPrettier(files, root, options);
  } else {
    return formatFilesWithOxfmt(files, root, options);
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
          console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
        }
      }
    })
  );

  return results;
}

async function formatFilesWithOxfmt(
  files: { path: string; content: string | Buffer }[],
  root: string,
  options?: { silent?: boolean }
): Promise<Map<string, string>> {
  try {
    // A single oxfmt invocation for the whole batch - the binary costs
    // ~100ms to start, so one process per file does not scale.
    const { formatted, error } = await batchFormatWithOxfmt(
      files.map((file) => ({
        path: file.path,
        content: file.content.toString('utf-8'),
      })),
      root
    );
    if (error && !options?.silent) {
      console.warn(`Could not format some files with oxfmt. Error: "${error}"`);
    }
    return formatted;
  } catch (e) {
    if (!options?.silent) {
      console.warn(`Could not format files with oxfmt. Error: "${e.message}"`);
    }
    return new Map<string, string>();
  }
}
