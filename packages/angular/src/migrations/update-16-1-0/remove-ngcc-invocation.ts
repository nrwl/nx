import type { Tree } from '@nx/devkit';
import { formatFiles, updateJson } from '@nx/devkit';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (!json.scripts?.postinstall?.includes('ngcc ')) {
      return json;
    }

    json.scripts.postinstall = json.scripts.postinstall
      // special case when ngcc is at the start so we remove the && as well
      .replace(/^(ngcc.*?&& *)(.*)/, '$2')
      // everything else
      .replace(/(.*?)((&& *)?ngcc.*?)((?=&)|$)(.*)/, '$1$5')
      .trim();

    if (json.scripts.postinstall === '') {
      json.scripts.postinstall = undefined;
    }

    return json;
  });

  await formatFiles(tree);
}
