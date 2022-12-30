import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export default async function (tree: Tree) {
  const workspace = readWorkspaceConfiguration(tree);

  if (!workspace.generators) {
    return;
  }

  if (workspace.generators['@nrwl/angular:library']) {
    delete workspace.generators['@nrwl/angular:library'].style;
    updateWorkspaceConfiguration(tree, workspace);
  } else if (workspace.generators['@nrwl/angular']?.library) {
    delete workspace.generators['@nrwl/angular'].library.style;
    updateWorkspaceConfiguration(tree, workspace);
  }

  await formatFiles(tree);
}
