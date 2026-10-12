import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { locateTouchedProjects } from '../../native';
import { capabilitiesOfConfiguredPlugins } from '../plugins/get-plugins';
import { workspaceRoot } from '../../utils/workspace-root';
import { FileChange, isDeletedFile } from '../file-utils';
import { getTouchedProjects as getJSTouchedProjects } from '../../plugins/js/project-graph/affected/touched-projects';
import { transformProjectGraphForLocators } from '../../native/transform-objects';

/** Runs every locator and returns what each one marked, duplicates included. */
export async function runTouchedProjectLocators(
  graph: ProjectGraph,
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration,
  packageJson?: any,
  projectDeletionAffectsAllProjects = true
): Promise<string[]> {
  return locateTouchedProjects(
    transformProjectGraphForLocators(graph),
    nxJson,
    touchedFiles.map((f) => f.file),
    {
      // Only a deletion reaches projects_from_project_glob_changes, and
      // resolving the patterns can fall back to starting plugin workers.
      projectGlobPatterns: touchedFiles.some((f) => isDeletedFile(f.file))
        ? await getProjectGlobPatterns(nxJson)
        : [],
      projectDeletionAffectsAllProjects,
      workspaceRoot,
    },
    // Takes only paths, so the closure carries the FileChange objects: their
    // lazy getChanges() cannot cross the native boundary.
    [
      async () =>
        getJSTouchedProjects(
          touchedFiles,
          graph.nodes,
          nxJson,
          packageJson,
          graph,
          projectDeletionAffectsAllProjects
        ),
    ]
  );
}

/** Resolved here because the native side takes the patterns, not the plugins. */
export async function getProjectGlobPatterns(
  nxJson: NxJsonConfiguration
): Promise<string[]> {
  if (process.env.NX_FORCE_REUSE_CACHED_GRAPH === 'true') {
    return [
      '**/package.json',
      '**/project.json',
      'project.json',
      'package.json',
    ];
  }
  const capabilities = await capabilitiesOfConfiguredPlugins(
    nxJson,
    workspaceRoot
  );
  return capabilities
    .map((capability) => capability.createNodesPattern)
    .filter((pattern) => !!pattern);
}
