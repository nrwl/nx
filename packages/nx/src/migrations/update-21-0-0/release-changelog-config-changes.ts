import {
  NxJsonConfiguration,
  NxReleaseChangelogConfiguration,
  NxReleaseVersionConfiguration,
} from '../../config/nx-json';
import { formatChangedFilesWithPrettierIfAvailable } from '../../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree) as NxJsonConfiguration;
  if (!nxJson || !nxJson.release) {
    return;
  }

  function updateProperty(changelogConfig: NxReleaseChangelogConfiguration) {
    if (
      changelogConfig.renderOptions &&
      'mapAuthorsToGitHubUsernames' in changelogConfig.renderOptions
    ) {
      changelogConfig.renderOptions.applyUsernameToAuthors =
        changelogConfig.renderOptions.mapAuthorsToGitHubUsernames;
      delete changelogConfig.renderOptions.mapAuthorsToGitHubUsernames;
    }
  }

  if (nxJson.release.changelog) {
    if (
      nxJson.release.changelog.workspaceChangelog &&
      typeof nxJson.release.changelog.workspaceChangelog !== 'boolean'
    ) {
      updateProperty(nxJson.release.changelog.workspaceChangelog);
    }
    if (
      nxJson.release.changelog.projectChangelogs &&
      typeof nxJson.release.changelog.projectChangelogs !== 'boolean'
    ) {
      updateProperty(nxJson.release.changelog.projectChangelogs);
    }
  }

  if (nxJson.release.groups) {
    for (const group of Object.values(nxJson.release.groups)) {
      if (group.changelog && typeof group.changelog !== 'boolean') {
        updateProperty(group.changelog);
      }
    }
  }

  updateNxJson(tree, nxJson);

  await formatChangedFilesWithPrettierIfAvailable(tree);
}
