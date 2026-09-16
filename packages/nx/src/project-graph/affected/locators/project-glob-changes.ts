import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { readNxJson } from '../../../config/nx-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getGlobPatternsOfPlugins } from '../../utils/retrieve-workspace-files';
import { combineGlobPatterns } from '../../../utils/globs';
import { getPlugins, peekPluginCapabilities } from '../../plugins/get-plugins';
import { isDeletedFileChange } from '../../file-utils';

export const getTouchedProjectsFromProjectGlobChanges: TouchedProjectLocator =
  async (
    touchedFiles,
    projectGraphNodes,
    _nxJson,
    _packageJson,
    _projectGraph,
    projectDeletionAffectsAllProjects = true
  ): Promise<string[]> => {
    // A deleted project configuration file is the only thing this locator
    // answers for, so a change set without a deletion in it has nothing to find
    // and the patterns it would be matched against are not worth asking the
    // plugins for.
    const deleted = touchedFiles.filter((touchedFile) =>
      touchedFile.getChanges().some(isDeletedFileChange)
    );
    if (!deleted.length) {
      return [];
    }

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

    const configDeleted = deleted.some((touchedFile) =>
      minimatch(touchedFile.file, globPattern, { dot: true })
    );

    // If any project has been deleted, we must assume all projects were
    // affected. A modified project configuration is under its own project's
    // root, which marks that project affected without this locator.
    return configDeleted && projectDeletionAffectsAllProjects
      ? Object.keys(projectGraphNodes)
      : [];
  };
