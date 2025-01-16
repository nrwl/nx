import { joinPathFragments, updateJson, type Tree } from '@nx/devkit';

export function sortPackageJsonFields(tree: Tree, projectRoot: string) {
  const packageJsonPath = joinPathFragments(projectRoot, 'package.json');
  if (!tree.exists(packageJsonPath)) return;
  updateJson(tree, packageJsonPath, (json) => {
    // Note that these are fields that our generators may use, so it's not exhaustive.
    const orderedTopFields = new Set([
      'name',
      'version',
      'private',
      'description',
      'type',
      'main',
      'module',
      'types',
      'exports',
    ]);
    const orderedBottomFields = new Set([
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]);
    const otherFields = new Set(
      Object.keys(json).filter(
        (k) => !orderedTopFields.has(k) && !orderedBottomFields.has(k)
      )
    );
    const allFields = [
      ...orderedTopFields,
      ...otherFields,
      ...orderedBottomFields,
    ];
    const sortedJson = {};
    for (const k of allFields) {
      sortedJson[k] = json[k];
    }
    return sortedJson;
  });
}
