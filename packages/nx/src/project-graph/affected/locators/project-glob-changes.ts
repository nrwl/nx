import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { readNxJson } from '../../../config/nx-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getGlobPatternsOfPlugins } from '../../utils/retrieve-workspace-files';
import { combineGlobPatterns } from '../../../utils/globs';
import { getPlugins, peekPluginCapabilities } from '../../plugins/get-plugins';
import { isDeletedFile } from '../../file-utils';

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
    //
    // Asked of each path rather than of its changes: `getChanges` answers this
    // first and then, for a json or lock file that is still there, reads it at
    // two revisions and parses both. Every other locator evaluates that for one
    // file; this one would evaluate it for all of them.
    const deleted = touchedFiles.filter((touchedFile) =>
      isDeletedFile(touchedFile.file)
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
      // whose plugins are on record answers without loading any of them. An
      // empty record set is not a miss: this loads whatever nothing has
      // recorded, writes the records and puts those plugins back down.
      const recorded = await peekPluginCapabilities(nxJson, workspaceRoot);
      if (recorded) {
        return combineGlobPatterns(
          recorded
            .map((capabilities) => capabilities.createNodesPattern)
            .filter((pattern) => !!pattern)
        );
      }

      // Null says no record could be kept, rather than that none was found:
      // this runtime cannot observe what a load reads, or a plugin could not be
      // keyed or loaded at all. Loading here is what every version did before
      // the records existed, and it is where a plugin that failed reports it.
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
