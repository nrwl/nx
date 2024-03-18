import {
  joinPathFragments,
  readNxJson,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';

/** @deprecated Do not use this function as the root babel.config.json file is no longer needed */
// TODO(jack): Remove This in Nx 17 once we don't need to support Nx 15 anymore. Currently this function is used in v15 migrations.
export function addBabelInputs(tree: Tree) {
  const nxJson = readNxJson(tree);
  let globalBabelFile = ['babel.config.js', 'babel.config.json'].find((file) =>
    tree.exists(file)
  );

  if (!globalBabelFile) {
    writeJson(tree, '/babel.config.json', {
      babelrcRoots: ['*'], // Make sure .babelrc files other than root can be loaded in a monorepo
    });
    globalBabelFile = 'babel.config.json';
  }

  if (nxJson.namedInputs?.sharedGlobals) {
    const sharedGlobalFileset = new Set(nxJson.namedInputs.sharedGlobals);
    sharedGlobalFileset.add(
      joinPathFragments('{workspaceRoot}', globalBabelFile)
    );
    nxJson.namedInputs.sharedGlobals = Array.from(sharedGlobalFileset);
  }

  updateNxJson(tree, nxJson);
}
