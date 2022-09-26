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
  getGlobPatternsFromPlugins,
} from 'nx/src/config/workspaces';
import { workspaceRoot } from 'nx/src/utils/workspace-root';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator<
  WholeFileChange | JsonChange | DeletedFileChange
> = (touchedFiles, projectGraphNodes, nxJson): string[] => {
  const pluginGlobPatterns = getGlobPatternsFromPlugins(nxJson, [
    workspaceRoot,
  ]);
  const workspacesGlobPatterns =
    getGlobPatternsFromPackageManagerWorkspaces(workspaceRoot);

  const patterns = [
    '**/project.json',
    ...pluginGlobPatterns,
    ...workspacesGlobPatterns,
  ];
  const combinedGlobPattern = '{' + patterns.join(',') + '}';

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

      // Find the project that contains it, and mark it as affected
      const [project] =
        Object.entries(projectGraphNodes).find(([p, c]) =>
          c.data.files.some((f) => f.file === touchedFile.file)
        ) ?? [];
      if (project) {
        touchedProjects.add(project);
      }
    }
  }

  return Array.from(touchedProjects);
};
