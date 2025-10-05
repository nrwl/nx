import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { workspaceRoot } from '../../../utils/workspace-root';
import { join } from 'path';
import { existsSync } from 'fs';
import { getGlobPatternsOfPlugins } from '../../utils/retrieve-workspace-files';
import { combineGlobPatterns } from '../../../utils/globs';
import { getPlugins } from '../../plugins/get-plugins';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (touchedFiles, projectGraphNodes): Promise<string[]> => {
    const globPattern = await (async () => {
      // TODO: We need a quicker way to get patterns that should not
      // require starting up plugin workers
      if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
        return combineGlobPatterns([
          '**/package.json',
          '**/project.json',
          'project.json',
          'package.json',
        ]);
      }
      const plugins = (await getPlugins()).filter((p) => !!p.createNodes);
      return combineGlobPatterns(getGlobPatternsOfPlugins(plugins));
    })();

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
