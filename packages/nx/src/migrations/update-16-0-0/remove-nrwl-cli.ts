import { Tree } from '../../generators/tree.js';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available.js';
import { updateJson } from '../../generators/utils/json.js';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    for (const deps of [json.dependencies, json.devDependencies]) {
      if (deps) {
        delete deps['@nrwl/cli'];
      }
    }

    return json;
  });

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
