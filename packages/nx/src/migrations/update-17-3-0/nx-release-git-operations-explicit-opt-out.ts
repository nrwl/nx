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

    // Opt out of staging changes in version only if using
    // granular git config AND if committing is not enabled.
    // We don't want to add granular git config if it doesn't already exist,
    // because the nx release meta command is incompatible with it.
    if (
      (nxJson.release.version?.git || nxJson.release.changelog?.git) &&
      !nxJson.release.git.commit &&
      !nxJson.release.version?.git?.commit &&
      !nxJson.release.changelog?.git?.commit
    ) {
      nxJson.release.version = {
        ...nxJson.release.version,
        git: {
          ...nxJson.release.version?.git,
          stageChanges: false,
        },
      };
    }

    // Ensure that we don't leave any empty object properties in their config
    if (Object.keys(nxJson.release.git).length === 0) {
      delete nxJson.release.git;
    }

    return nxJson;
  });
}
