import * as path from 'path';
import type * as Prettier from 'prettier';
import { detectFormatter } from '../../utils/formatter';
import { formatContentWithOxfmt } from '../../utils/oxfmt';
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
  const results = new Map<string, string>();

  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const formatted = await formatContentWithOxfmt(
          path.join(root, file.path),
          file.content.toString('utf-8')
        );
        results.set(file.path, formatted);
      } catch (e) {
        if (!options?.silent) {
          console.warn(`Could not format ${file.path}. Error: "${e.message}"`);
        }
      }
    })
  );

  return results;
}
