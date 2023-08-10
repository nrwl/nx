import { TouchedProjectLocator } from '../affected-project-graph-models';
import minimatch = require('minimatch');
import { workspaceRoot } from '../../../utils/workspace-root';
import { getNxRequirePaths } from '../../../utils/installation-directory';
import { join } from 'path';
import { existsSync } from 'fs';
import { configurationGlobs } from '../../utils/retrieve-workspace-files';
import { ensurePluginIsV2, loadNxPlugins } from '../../../utils/nx-plugin';
import { combineGlobPatterns } from '../../../utils/globs';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (touchedFiles, projectGraphNodes, nxJson): Promise<string[]> => {
    const globPattern = combineGlobPatterns(
      configurationGlobs(
        workspaceRoot,
        await loadNxPlugins(
          nxJson?.plugins,
          getNxRequirePaths(workspaceRoot),
          workspaceRoot
        ).then((p) => p.map((plugin) => ensurePluginIsV2(plugin)))
      )
    );

    const touchedProjects = new Set<string>();
    for (const touchedFile of touchedFiles) {
      const isProjectFile = minimatch(touchedFile.file, globPattern);
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
