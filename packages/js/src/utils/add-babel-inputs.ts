import {
  formatFiles,
  joinPathFragments,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
  writeJson,
} from '@nrwl/devkit';

export async function addBabelInputs(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);
  let globalBabelFile = ['babel.config.js', 'babel.config.json'].find((file) =>
    tree.exists(file)
  );

  if (!globalBabelFile) {
    writeJson(tree, '/babel.config.json', {
      babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
    });
    globalBabelFile = 'babel.config.json';
  }

  if (workspaceConfiguration.namedInputs?.sharedGlobals) {
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
