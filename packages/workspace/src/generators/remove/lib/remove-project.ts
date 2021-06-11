import { ProjectConfiguration, Tree, visitNotIgnoredFiles } from '@nrwl/devkit';

/**
 * Removes (deletes) a project's files from the folder tree
 */
export function removeProject(tree: Tree, project: ProjectConfiguration) {
  visitNotIgnoredFiles(tree, project.root, (file) => {
    tree.delete(file);
  });
  tree.delete(project.root);
}
