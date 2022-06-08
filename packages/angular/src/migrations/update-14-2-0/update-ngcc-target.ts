import { formatFiles, Tree, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  let shouldFormat = false;

  updateJson(tree, 'package.json', (json) => {
    if (json.scripts?.postinstall?.includes('ngcc ')) {
      json.scripts.postinstall = json.scripts.postinstall.replace(
        /(.*)(ngcc --properties es2015 )(.*)/,
        '$1ngcc --properties es2020 $3'
      );
      shouldFormat = true;
    }

    return json;
  });

  if (shouldFormat) {
    await formatFiles(tree);
  }
}
