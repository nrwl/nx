import {
  type Tree,
  updateJson,
  readProjectConfiguration,
  offsetFromRoot,
  joinPathFragments,
} from '@nx/devkit';

export function addFileToRemoteTsconfig(
  tree: Tree,
  remoteName: string,
  pathToExpose: string
) {
  const remote = readProjectConfiguration(tree, remoteName);
  updateJson(tree, remote.targets.build.options.tsConfig, (json) => ({
    ...json,
    files: [
      ...json.files,
      joinPathFragments(offsetFromRoot(remote.root), pathToExpose),
    ],
  }));
}
