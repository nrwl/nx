import {
  DeletedFileChange,
  isDeletedFileChange,
  WholeFileChange,
} from '../../file-utils';
import { JsonChange } from '../../../utils/json-diff';
import { TouchedProjectLocator } from '../affected-project-graph-models';
import minimatch = require('minimatch');
import {
  getGlobPatternsFromPackageManagerWorkspaces,
  getGlobPatternsFromPluginsAsync,
} from '../../../config/workspaces';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getNxRequirePaths } from '../../../utils/installation-directory';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator<
  WholeFileChange | JsonChange | DeletedFileChange
> = async (touchedFiles, projectGraphNodes, nxJson): Promise<string[]> => {
  const pluginGlobPatterns = await getGlobPatternsFromPluginsAsync(
    nxJson,
    getNxRequirePaths(),
    workspaceRoot
  );
  const workspacesGlobPatterns =
    getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot) || [];

  const patterns = [
    '**/project.json',
    ...pluginGlobPatterns,
    ...workspacesGlobPatterns,
  ];
  const combinedGlobPattern =
    patterns.length === 1 ? '**/project.json' : '{' + patterns.join(',') + '}';
  const touchedProjects = new Set<string>();
  for (const touchedFile of touchedFiles) {
    const isProjectFile = minimatch(touchedFile.file, combinedGlobPattern);
    if (isProjectFile) {
      if (
        touchedFile.getChanges().some((change) => isDeletedFileChange(change))
      ) {
        // If any project has been deleted, we must assume all projects were affected
        return Object.keys(projectGraphNodes);
      }

      // Modified project config files are under a project's root, and implicitly
      // mark it as affected. Thus, we don't need to handle it here.
    }
  }

  return Array.from(touchedProjects);
};
