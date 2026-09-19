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
    // Only deletions matter here. Uses `isDeletedFile`, not `getChanges()`,
    // which also parses json/lock files at two revisions for every touched file.
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
