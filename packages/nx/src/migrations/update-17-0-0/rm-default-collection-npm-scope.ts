import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { readJson } from '../../generators/utils/json';
import { output } from '../../utils/output';
import { NxJsonConfiguration } from '../../config/nx-json';
import { joinPathFragments } from '../../utils/path';

export default async function update(tree: Tree) {
  if (!tree.exists('nx.json')) {
    return;
  }

  const nxJson = readNxJson(tree);

  delete nxJson.cli?.['defaultCollection'];

  if (nxJson?.cli && Object.keys(nxJson.cli).length < 1) {
    delete nxJson.cli;
  }

  warnNpmScopeHasChanged(tree, nxJson);

  delete nxJson['npmScope'];

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}

function warnNpmScopeHasChanged(
  tree: Tree,
  nxJson: NxJsonConfiguration
): boolean {
  const originalScope = nxJson['npmScope'];

  // There was no original scope
  if (!originalScope) {
    return false;
  }

  // package.json does not exist
  if (!tree.exists('package.json')) {
    return false;
  }

  const newScope = getNpmScopeFromPackageJson(tree);

  // New and Original scope are the same.
  if (originalScope === newScope) {
    return false;
  }

  const packageJsonName = readJson(tree, 'package.json').name;

  if (newScope) {
    output.warn({
      title: 'npmScope has been removed from nx.json',
      bodyLines: [
        'This will now be read from package.json',
        `Old value which was in nx.json: ${originalScope}`,
        `New value from package.json: ${newScope}`,
        `Typescript path mappings for new libraries will now be generated as such: @${newScope}/new-lib instead of @${originalScope}/new-lib`,
        `If you would like to change this back, change the name in package.json to ${packageJsonName.replace(
          newScope,
          originalScope
        )}`,
      ],
    });
  } else {
    // There is no scope in package.json
    output.warn({
      title: 'npmScope has been removed from nx.json',
      bodyLines: [
        'This will now be read from package.json',
        `Old value which was in nx.json: ${originalScope}`,
        `New value from package.json: null`,
        `Typescript path mappings for new libraries will now be generated as such: new-lib instead of @${originalScope}/new-lib`,
        `If you would like to change this back, change the name in package.json to ${joinPathFragments(
          `@${originalScope}`,
          packageJsonName
        )}`,
      ],
    });
  }
}

function getNpmScopeFromPackageJson(tree: Tree) {
  const { name } = tree.exists('package.json')
    ? readJson<{ name?: string }>(tree, 'package.json')
    : { name: null };

  if (name?.startsWith('@')) {
    return name.split('/')[0].substring(1);
  }
}
