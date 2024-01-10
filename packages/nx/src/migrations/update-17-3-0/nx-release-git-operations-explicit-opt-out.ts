import { NxJsonConfiguration } from '../../config/nx-json';
import { Tree } from '../../generators/tree';
import { updateJson } from '../../generators/utils/json';

export default function nxReleaseGitOperationsExplicitOptOut(tree: Tree) {
  if (!tree.exists('nx.json')) {
    return;
  }

  updateJson<NxJsonConfiguration>(tree, 'nx.json', (nxJson) => {
    if (!nxJson.release) {
      return nxJson;
    }

    nxJson.release.git = nxJson.release.git ?? {};

    // Explicitly opt out of git operations if not defined
    // to preserve the old behavior
    if (
      nxJson.release.git.commit === undefined &&
      nxJson.release.changelog?.git?.commit === undefined
    ) {
      nxJson.release.git.commit = false;
    }
    if (
      nxJson.release.git.tag === undefined &&
      nxJson.release.changelog?.git?.tag === undefined
    ) {
      nxJson.release.git.tag = false;
    }

    // Consolidate version.git and changelog.git if they have matching values
    if (
      nxJson.release.version?.git?.commit !== undefined &&
      nxJson.release.version?.git?.commit ===
        nxJson.release.changelog?.git?.commit
    ) {
      nxJson.release.git.commit = nxJson.release.version.git.commit;
      delete nxJson.release.version.git.commit;
      delete nxJson.release.changelog.git.commit;
    }
    if (
      nxJson.release.version?.git?.tag !== undefined &&
      nxJson.release.version?.git?.tag === nxJson.release.changelog?.git?.tag
    ) {
      nxJson.release.git.tag = nxJson.release.version.git.tag;
      delete nxJson.release.version.git.tag;
      delete nxJson.release.changelog.git.tag;
    }

    // Ensure that we don't leave any empty object properties in their config
    removeIfEmpty(nxJson.release.version, 'git');
    removeIfEmpty(nxJson.release.changelog, 'git');
    removeIfEmpty(nxJson.release, 'version');
    removeIfEmpty(nxJson.release, 'changelog');
    removeIfEmpty(nxJson.release, 'git');

    return nxJson;
  });
}

function removeIfEmpty(obj: unknown, key: string) {
  if (!obj) {
    return;
  }
  if (obj[key] && Object.keys(obj[key]).length === 0) {
    delete obj[key];
  }
}
