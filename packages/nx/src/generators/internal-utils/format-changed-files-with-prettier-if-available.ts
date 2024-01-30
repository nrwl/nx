import type { Tree } from '../tree';
import * as path from 'path';
import type * as Prettier from 'prettier';

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
  let prettier: typeof Prettier;
  try {
    prettier = await import('prettier');
  } catch {}

  if (!prettier) return;

  const files = new Set(
    tree.listChanges().filter((file) => file.type !== 'DELETE')
  );
  await Promise.all(
    Array.from(files).map(async (file) => {
      try {
        const systemPath = path.join(tree.root, file.path);
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

        tree.write(
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
}
