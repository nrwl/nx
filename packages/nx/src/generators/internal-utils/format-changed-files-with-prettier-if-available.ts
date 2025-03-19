import * as path from 'path';
import type * as Prettier from 'prettier';
import { isUsingPrettier } from '../../utils/is-using-prettier';
import type { Tree } from '../tree';

/**
 * Formats all the created or updated files using Prettier
 * @param tree - the file system tree
 */
export async function formatChangedFilesWithPrettierIfAvailable(
  tree: Tree,
  options?: {
    silent?: boolean;
  }
): Promise<void> {
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

  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
    /**
     * Even after we discovered prettier in node_modules, we need to be sure that the user is intentionally using prettier
     * before proceeding to format with it.
     */
    if (!isUsingPrettier(root)) {
      return results;
    }
  } catch {}

  if (!prettier) {
    return results;
  }

  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const systemPath = path.join(root, file.path);
        let options: any = {
          filepath: systemPath,
        };

        const resolvedOptions = await prettier.resolveConfig(systemPath, {
          editorconfig: true,
        });
        if (!resolvedOptions) {
          return;
        }
        options = {
          ...options,
          ...resolvedOptions,
        };

        const support = await prettier.getFileInfo(systemPath, options);
        if (support.ignored || !support.inferredParser) {
          return;
        }

        results.set(
          file.path,
          // In prettier v3 the format result is a promise
          await (prettier.format(file.content.toString('utf-8'), options) as
            | Promise<string>
            | string)
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
