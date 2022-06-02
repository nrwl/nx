import { Tree } from '../../generators/tree';
import {
  getProjects,
  updateProjectConfiguration,
} from '../../generators/utils/project-configuration';
import { isRelativePath } from 'nx/src/utils/fileutils';
import { joinPathFragments } from 'nx/src/utils/path';

export default async function (tree: Tree) {
  for (const [name, value] of getProjects(tree).entries()) {
    for (const t of Object.values(value.targets)) {
      if (t.outputs) {
        t.outputs = t.outputs.map((o) =>
          isRelativePath(o) ? joinPathFragments(value.root, o) : o
        );
      }
    }
    updateProjectConfiguration(tree, name, value);
  }
}
