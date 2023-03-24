import {
  formatFiles,
  joinPathFragments,
  readNxJson,
  Tree,
  updateNxJson,
  writeJson,
} from '@nrwl/devkit';

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
