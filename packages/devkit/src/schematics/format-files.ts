import { Tree } from '@nrwl/tao/src/shared/tree';
import * as path from 'path';
import type * as Prettier from 'prettier';

let prettier: typeof Prettier;
try {
  prettier = require('prettier');
} catch (e) {}

/**
 * Formats all the created or updated files using Prettier
 * @param host
 */
export async function formatFiles(host: Tree) {
  if (!prettier) return;

  const files = new Set(
    host.listChanges().filter((file) => file.type !== 'DELETE')
  );
  await Promise.all(
    Array.from(files).map(async (file) => {
      const systemPath = path.join(host.root, file.path);
      let options: any = {
        filepath: systemPath,
      };
      const resolvedOptions = await prettier.resolveConfig(systemPath);
      if (resolvedOptions) {
        options = {
          ...options,
          ...resolvedOptions,
        };
      }
      const support = await prettier.getFileInfo(systemPath, options);
      if (support.ignored || !support.inferredParser) {
        return;
      }

      try {
        host.write(
          file.path,
          prettier.format(file.content.toString(), options)
        );
      } catch (e) {
        console.warn(`Could not format ${file.path} because ${e.message}`);
      }
    })
  );
}
