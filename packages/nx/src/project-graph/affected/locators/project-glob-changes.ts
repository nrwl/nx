import { TouchedProjectLocator } from '../affected-project-graph-models';
import picomatch from 'picomatch';
import { readNxJson } from '../../../config/nx-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { join } from 'path';
import { existsSync } from 'fs';
import { getGlobPatternsOfPlugins } from '../../utils/retrieve-workspace-files';
import { splitGlobPatterns } from '../../../utils/globs';
import { getPlugins } from '../../plugins/get-plugins';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (
    touchedFiles,
    projectGraphNodes,
    _nxJson,
    _packageJson,
    _projectGraph,
    projectDeletionAffectsAllProjects = true
  ): Promise<string[]> => {
    const globPatterns = await (async () => {
      // TODO: We need a quicker way to get patterns that should not
      // require starting up plugin workers
      if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
        return [
          '**/package.json',
          '**/project.json',
          'project.json',
          'package.json',
        ];
      }
      const plugins = (await getPlugins(readNxJson(workspaceRoot))).filter(
        (p) => !!p.createNodes
      );
      // plugin globs may be combined `{a,b}` patterns; split so leading `**/`
      // keeps matching root-level files (see splitGlobPatterns)
      return getGlobPatternsOfPlugins(plugins).flatMap(splitGlobPatterns);
    })();

    if (!globPatterns.length) {
      // no plugins with createNodes patterns; picomatch throws on empty patterns
      return [];
    }

    const isProjectFilePattern = picomatch(globPatterns, { dot: true });
    const touchedProjects = new Set<string>();
    for (const touchedFile of touchedFiles) {
      const isProjectFile = isProjectFilePattern(touchedFile.file);
      if (isProjectFile) {
        // If the file no longer exists on disk, then it was deleted
        if (!existsSync(join(workspaceRoot, touchedFile.file))) {
          // If any project has been deleted, we must assume all projects were affected
          if (projectDeletionAffectsAllProjects) {
            return Object.keys(projectGraphNodes);
          }
          continue;
        }

        // Modified project config files are under a project's root, and implicitly
        // mark it as affected. Thus, we don't need to handle it here.
      }
    }

    return Array.from(touchedProjects);
  };
