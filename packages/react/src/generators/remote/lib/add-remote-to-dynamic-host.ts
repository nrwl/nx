import { Tree } from '@nx/devkit';

export function addRemoteToDynamicHost(
  tree: Tree,
  remoteName: string,
  remotePort: number,
  pathToMfManifest: string
) {
  if (tree.exists(pathToMfManifest)) {
    const current = tree.read(pathToMfManifest, 'utf8');
    tree.write(
      pathToMfManifest,
      JSON.stringify({
        ...JSON.parse(current),
        [remoteName]: `http://localhost:${remotePort}`,
      })
    );
  }
}
