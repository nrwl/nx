import type { Tree } from '@nrwl/devkit';
import { formatFiles, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (json.scripts?.postinstall?.includes('ngcc')) {
      json.scripts.postinstall = json.scripts.postinstall.replace(
        /(.*)(ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points)(.*)/,
        '$1ngcc --properties es2015 browser module main$3'
      );
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
