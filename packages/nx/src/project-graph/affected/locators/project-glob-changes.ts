import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { workspaceRoot } from '../../../utils/workspace-root';
import { join } from 'path';
import { existsSync } from 'fs';
import { configurationGlobs } from '../../utils/retrieve-workspace-files';
import { loadNxPlugins } from '../../plugins/internal-api';
import { combineGlobPatterns } from '../../../utils/globs';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (touchedFiles, projectGraphNodes, nxJson): Promise<string[]> => {
    const [plugins] = await loadNxPlugins(nxJson?.plugins ?? [], workspaceRoot);
    const globPattern = combineGlobPatterns(configurationGlobs(plugins));

    const touchedProjects = new Set<string>();
    for (const touchedFile of touchedFiles) {
      const isProjectFile = minimatch(touchedFile.file, globPattern, {
        dot: true,
      });
      if (isProjectFile) {
        // If the file no longer exists on disk, then it was deleted
        if (!existsSync(join(workspaceRoot, touchedFile.file))) {
          // If any project has been deleted, we must assume all projects were affected
          return Object.keys(projectGraphNodes);
        }

        // Modified project config files are under a project's root, and implicitly
        // mark it as affected. Thus, we don't need to handle it here.
      }
    }

    return Array.from(touchedProjects);
  };
