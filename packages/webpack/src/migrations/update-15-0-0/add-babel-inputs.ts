import {
  formatFiles,
  joinPathFragments,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const globalBabelFile = ['babel.config.js', 'babel.config.json'].find(
    (file) => tree.exists(file)
  );

  if (globalBabelFile && workspaceConfiguration.namedInputs?.sharedGlobals) {
    const sharedGlobalFileset = new Set(
      workspaceConfiguration.namedInputs.sharedGlobals
    );
    sharedGlobalFileset.add(
      joinPathFragments('{workspaceRoot}', globalBabelFile)
    );
    workspaceConfiguration.namedInputs.sharedGlobals =
      Array.from(sharedGlobalFileset);
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatFiles(tree);
}
