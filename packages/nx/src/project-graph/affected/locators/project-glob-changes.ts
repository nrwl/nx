import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { readNxJson } from '../../../config/nx-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { join } from 'path';
import { existsSync } from 'fs';
import { getGlobPatternsOfPlugins } from '../../utils/retrieve-workspace-files';
import { combineGlobPatterns } from '../../../utils/globs';
import { getPlugins, peekPluginCapabilities } from '../../plugins/get-plugins';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (
    touchedFiles,
    projectGraphNodes,
    _nxJson,
    _packageJson,
    _projectGraph,
    projectDeletionAffectsAllProjects = true
  ): Promise<string[]> => {
    const globPattern = await (async () => {
      if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
        return combineGlobPatterns([
          '**/package.json',
          '**/project.json',
          'project.json',
          'package.json',
        ]);
      }

      const nxJson = readNxJson(workspaceRoot);

      // Which files a plugin claims is all this locator wants, so a workspace
      // whose plugins are all on record answers without loading any of them.
      const recorded = await peekPluginCapabilities(nxJson, workspaceRoot);
      if (recorded) {
        return combineGlobPatterns(
          recorded
            .map((capabilities) => capabilities.createNodesPattern)
            .filter((pattern) => !!pattern)
        );
      }

      const plugins = (await getPlugins(nxJson)).filter((p) => !!p.createNodes);
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
