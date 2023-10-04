import { Tree } from '../../generators/tree';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { isRelativePath } from '../../utils/fileutils';
import { joinPathFragments } from '../../utils/path';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';

export default async function (tree: Tree) {
  for (const [name, value] of getProjects(tree).entries()) {
    if (!value.targets) {
      continue;
    }
    for (const t of Object.values(value.targets)) {
      if (t.outputs) {
        t.outputs = t.outputs.map((o) =>
          isRelativePath(o) ? joinPathFragments(value.root, o) : o
        );
      }
    }
    updateProjectConfiguration(tree, name, value);
  }
  await formatChangedFilesWithPrettierIfAvailable(tree);
}
