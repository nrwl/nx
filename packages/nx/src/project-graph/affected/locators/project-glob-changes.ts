import { TouchedProjectLocator } from '../affected-project-graph-models';
import { minimatch } from 'minimatch';
import { readNxJson } from '../../../config/nx-json';
import { workspaceRoot } from '../../../utils/workspace-root';
import { combineGlobPatterns } from '../../../utils/globs';
import { capabilitiesOfConfiguredPlugins } from '../../plugins/get-plugins';
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
      // whose plugins are on record answers without loading any of them. A
      // plugin nothing has recorded is loaded once to record it, and a runtime
      // that can keep no records at all loads them the ordinary way.
      const capabilities = await capabilitiesOfConfiguredPlugins(
        nxJson,
        workspaceRoot
      );
      return combineGlobPatterns(
        capabilities
          .map((capability) => capability.createNodesPattern)
          .filter((pattern) => !!pattern)
      );
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
